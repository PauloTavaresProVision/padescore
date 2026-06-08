import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getCompetitionSnapshot,
  combineGameDateTime,
} from "@/lib/padelteams/client";

export const dynamic = "force-dynamic";

/**
 * POST /api/reschedule-request
 *
 * Submete um pedido de alteração de horário. Endpoint PÚBLICO (sem auth)
 * mas com validações:
 *   1. competitionCode + gameId existe no PadelTeams (snapshot)
 *   2. requesterPhone normalizado para E.164
 *   3. Rate-limit: máx 3 pedidos / telemóvel / hora
 *
 * Body JSON:
 *   {
 *     competitionCode: "rjlloc",
 *     padelteamsGameId: 12345,
 *     requesterName: "Maria João",
 *     requesterPhone: "+244923456789",
 *     reason: "Conflito com viagem de trabalho",
 *     preferredSlot?: "Sábado tarde ou domingo manhã"
 *   }
 *
 * Resposta 201:
 *   { id: "uuid", status: "pending" }
 *
 * F2 vai adicionar SMS OTP step antes deste endpoint.
 */

const RATE_LIMIT_PER_HOUR = 3;

function normalizePhone(raw: string, defaultCountry = "244"): string | null {
  if (!raw) return null;
  let s = raw.trim().replace(/[^\d+]/g, "");
  if (!s) return null;
  if (s.startsWith("+")) return s.length >= 10 ? s : null;
  if (s.startsWith("00")) {
    s = "+" + s.slice(2);
    return s.length >= 10 ? s : null;
  }
  if (s.length === 9) return `+${defaultCountry}${s}`;
  if (s.length === 12 && s.startsWith(defaultCountry)) return `+${s}`;
  if (s.length === 11 && s.startsWith("351")) return `+${s}`;
  return s.length >= 10 ? `+${s}` : null;
}

export async function POST(req: Request) {
  let body: {
    competitionCode?: string;
    padelteamsGameId?: number;
    requesterName?: string;
    requesterPhone?: string;
    reason?: string;
    preferredSlot?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body inválido (JSON esperado)" },
      { status: 400 },
    );
  }

  const competitionCode = String(body.competitionCode ?? "").trim();
  const padelteamsGameId = Number(body.padelteamsGameId ?? 0);
  const requesterName = String(body.requesterName ?? "").trim();
  const requesterPhoneRaw = String(body.requesterPhone ?? "").trim();
  const reason = String(body.reason ?? "").trim();
  const preferredSlot = body.preferredSlot
    ? String(body.preferredSlot).trim()
    : null;

  // Validação básica
  if (!competitionCode) {
    return NextResponse.json({ error: "competitionCode obrigatório" }, { status: 400 });
  }
  if (!Number.isFinite(padelteamsGameId) || padelteamsGameId <= 0) {
    return NextResponse.json({ error: "padelteamsGameId inválido" }, { status: 400 });
  }
  if (!requesterName || requesterName.length < 2) {
    return NextResponse.json({ error: "Nome obrigatório (mín 2 chars)" }, { status: 400 });
  }
  if (!reason || reason.length < 5) {
    return NextResponse.json({ error: "Motivo obrigatório (mín 5 chars)" }, { status: 400 });
  }
  const requesterPhone = normalizePhone(requesterPhoneRaw);
  if (!requesterPhone) {
    return NextResponse.json(
      { error: "Telemóvel inválido (formato esperado: +244923456789 ou 923456789)" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // Localizar o torneio pelo competition_code
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id")
    .eq("padelteams_competition_code", competitionCode)
    .maybeSingle();
  if (!tournament) {
    return NextResponse.json(
      { error: "Torneio não encontrado para esse código" },
      { status: 404 },
    );
  }

  // Rate-limit: máx 3 pedidos / hora / telemóvel
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("match_reschedule_requests")
    .select("id", { count: "exact", head: true })
    .eq("requester_phone", requesterPhone)
    .gte("created_at", oneHourAgo);
  if (count !== null && count >= RATE_LIMIT_PER_HOUR) {
    return NextResponse.json(
      {
        error: `Demasiados pedidos. Limite ${RATE_LIMIT_PER_HOUR}/hora por telemóvel. Tenta mais tarde.`,
      },
      { status: 429 },
    );
  }

  // Buscar snapshot do PadelTeams para validar gameId + construir game_snapshot
  let snapshot: Awaited<ReturnType<typeof getCompetitionSnapshot>>;
  try {
    snapshot = await getCompetitionSnapshot(competitionCode);
  } catch (e) {
    return NextResponse.json(
      { error: "Falha a validar jogo no PadelTeams", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
  const game = snapshot.games.find((g) => g.id === padelteamsGameId);
  if (!game) {
    return NextResponse.json(
      { error: "Jogo não encontrado neste torneio" },
      { status: 404 },
    );
  }

  // Snapshot mínimo (estável mesmo se PadelTeams alterar/remover depois)
  const tournamentName =
    snapshot.tournaments.find((t) =>
      // não temos game.tournament_id directo — usamos primeira partida do nome
      snapshot.games.some((g) => g.id === game.id),
    )?.name ?? "?";
  const gameSnapshot = {
    teamA: game.team1.players.map((p) => p.name).join(" / ") || game.team1.name,
    teamB: game.team2.players.map((p) => p.name).join(" / ") || game.team2.name,
    teamAPlayers: game.team1.players.map((p) => ({ id: p.id, name: p.name })),
    teamBPlayers: game.team2.players.map((p) => ({ id: p.id, name: p.name })),
    scheduledAt: combineGameDateTime(game).toISOString(),
    field: game.field?.description ?? null,
    category: tournamentName,
  };

  const { data: inserted, error: insErr } = await supabase
    .from("match_reschedule_requests")
    .insert({
      tournament_id: tournament.id,
      padelteams_game_id: padelteamsGameId,
      game_snapshot: gameSnapshot,
      requester_name: requesterName,
      requester_phone: requesterPhone,
      requester_phone_verified: false, // F2 vai actualizar via OTP
      reason,
      preferred_slot: preferredSlot,
    })
    .select("id, status, created_at")
    .single();

  if (insErr || !inserted) {
    return NextResponse.json(
      { error: "Falha a guardar pedido", detail: insErr?.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      id: inserted.id,
      status: inserted.status,
      createdAt: inserted.created_at,
      gameSnapshot,
    },
    { status: 201 },
  );
}
