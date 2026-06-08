import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getCompetitionSnapshot,
  combineGameDateTime,
} from "@/lib/padelteams/client";
import { sendSmsOne } from "@/lib/wesender/client";

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

  // Buscar snapshot do PadelTeams via API REST oficial (cache 30s).
  let snapshot: Awaited<ReturnType<typeof getCompetitionSnapshot>>;
  try {
    snapshot = await getCompetitionSnapshot(competitionCode);
  } catch (e) {
    return NextResponse.json(
      {
        error: "Falha a validar jogo no PadelTeams",
        detail: e instanceof Error ? e.message : String(e),
      },
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
  const gameSnapshot = {
    teamA: game.team1.players.map((p) => p.name).join(" / ") || game.team1.name,
    teamB: game.team2.players.map((p) => p.name).join(" / ") || game.team2.name,
    teamAPlayers: game.team1.players.map((p) => ({ id: p.id, name: p.name })),
    teamBPlayers: game.team2.players.map((p) => ({ id: p.id, name: p.name })),
    scheduledAt: combineGameDateTime(game).toISOString(),
    field: game.field?.description ?? null,
    category: null, // futuramente: lookup do tournament.name pelo phase_id
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

  // -------------------------------------------------------------------------
  // Criar acceptances para os OUTROS 3 jogadores (parceira + 2 adversários)
  // Match por nome fuzzy com players_contacts para obter telemóveis.
  // O requester é auto-aceite (não criamos linha para ele).
  // -------------------------------------------------------------------------
  const requesterNorm = normalizeName(requesterName);
  const team1Names = game.team1.players.map((p) => p.name);
  const team2Names = game.team2.players.map((p) => p.name);
  // Quem está na mesma dupla que o requester? A ou B?
  const requesterInA = team1Names.some(
    (n) =>
      normalizeName(n) === requesterNorm ||
      normalizeName(n).includes(requesterNorm) ||
      requesterNorm.includes(normalizeName(n)),
  );
  const partners = requesterInA ? team1Names : team2Names;
  const opponents = requesterInA ? team2Names : team1Names;

  // Buscar contactos de TODOS os jogadores que NÃO são o requester
  const otherNames = [
    ...partners.filter((n) => normalizeName(n) !== requesterNorm),
    ...opponents,
  ];

  const { data: allContacts } = await supabase
    .from("players_contacts")
    .select("name, phone, email")
    .eq("tournament_id", tournament.id);

  const contactByName = new Map<string, { phone: string; email: string | null }>();
  for (const c of allContacts ?? []) {
    contactByName.set(normalizeName(c.name), {
      phone: c.phone,
      email: c.email,
    });
  }

  function lookupContact(name: string): { phone: string | null; email: string | null } {
    const nn = normalizeName(name);
    // Match exacto primeiro
    if (contactByName.has(nn)) {
      const c = contactByName.get(nn)!;
      return { phone: c.phone, email: c.email };
    }
    // Fallback fuzzy (substring)
    for (const [k, v] of contactByName) {
      if (k.includes(nn) || nn.includes(k)) {
        return { phone: v.phone, email: v.email };
      }
    }
    return { phone: null, email: null };
  }

  const acceptanceRows = otherNames.map((name) => {
    const c = lookupContact(name);
    const role = partners.includes(name) ? "partner" : "opponent";
    return {
      request_id: inserted.id,
      player_name: name,
      player_role: role,
      player_phone: c.phone,
      player_email: c.email,
    };
  });

  if (acceptanceRows.length > 0) {
    const { error: accErr } = await supabase
      .from("reschedule_acceptances")
      .insert(acceptanceRows);
    if (accErr) {
      // Não bloqueia — o pedido foi guardado, só falhou criar acceptances
      console.warn(
        `[reschedule] falha a criar acceptances para request ${inserted.id}:`,
        accErr.message,
      );
    }
  }

  // Buscar os tokens das acceptances criadas para devolver ao frontend
  // (usa para gerar link de partilha no WhatsApp)
  const { data: createdAcceptances } = await supabase
    .from("reschedule_acceptances")
    .select("player_name, player_role, player_phone, acceptance_token")
    .eq("request_id", inserted.id);

  // -------------------------------------------------------------------------
  // Disparar SMS via Wesender para cada jogador que tem telemóvel.
  // Async em paralelo, não bloqueia a resposta — falhas são logadas mas não
  // partem o pedido (o frontend ainda tem links WhatsApp como backup).
  // -------------------------------------------------------------------------
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  // SMS curto cabe em 160 chars (Wesender substitui acentos por nós com
  // CEspeciais=false). Formato:
  //   "Standard Open: Niria pediu alteracao do jogo 13/06 11:45. Concordas? https://X/c/abc..."
  const eventShort = "Standard Open";
  const dayShort = game.date
    .split("-")
    .slice(1)
    .reverse()
    .join("/"); // YYYY-MM-DD → DD/MM
  const timeShort = game.time.slice(0, 5); // HH:MM:SS → HH:MM

  if (createdAcceptances && createdAcceptances.length > 0) {
    void Promise.allSettled(
      createdAcceptances
        .filter((a) => a.player_phone)
        .map(async (a) => {
          const url = `${appUrl}/c/${a.acceptance_token}`;
          const msg = `${eventShort}: ${requesterName} pediu alteracao do jogo ${dayShort} ${timeShort}. Concordas? ${url}`;
          try {
            await sendSmsOne(a.player_phone!, msg, {
              allowSpecialChars: false,
            });
            // Marca enviado na DB (best-effort)
            await supabase
              .from("reschedule_acceptances")
              .update({ decided_via: "sms_sent" })
              .eq("acceptance_token", a.acceptance_token);
          } catch (err) {
            console.warn(
              `[wesender] falha a enviar SMS para ${a.player_name} (${a.player_phone}):`,
              err instanceof Error ? err.message : err,
            );
          }
        }),
    );
  }

  return NextResponse.json(
    {
      id: inserted.id,
      status: inserted.status,
      createdAt: inserted.created_at,
      gameSnapshot,
      acceptances: createdAcceptances ?? [],
    },
    { status: 201 },
  );
}

/** Normaliza nome para matching: lowercase, sem acentos. */
function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}
