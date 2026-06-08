import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getCompetitionSnapshot,
  combineGameDateTime,
} from "@/lib/padelteams/client";

export const dynamic = "force-dynamic";

/**
 * POST /api/pedidos/[code]/lookup
 *
 * Endpoint público. Identifica o jogador pelo telemóvel e devolve os jogos
 * em que está envolvido (matching por nome com o snapshot PadelTeams).
 *
 * Body: { phone: "+244923456789" }
 *
 * Response 200 (1 jogador):
 *   {
 *     players: [{ name, category }],
 *     selectedPlayer: { name, category },
 *     games: [{ id, scheduledAt, field, teamA, teamB, ... }]
 *   }
 *
 * Response 200 (vários jogadores no mesmo telemóvel — casais):
 *   {
 *     players: [{ name, category }, { name, category }],
 *     selectedPlayer: null,  // frontend mostra dropdown
 *     games: []
 *   }
 *
 * Response 404: telemóvel não inscrito neste torneio.
 */

function normalizePhone(raw: string, defaultCountry = "244"): string | null {
  if (!raw) return null;
  if (/[Ee]\+?\d/.test(raw) && /\d\.\d/.test(raw)) return null;
  let s = raw.replace(/[^\d+]/g, "");
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

/**
 * Normaliza nome para matching: lowercase, sem acentos, sem espaços
 * múltiplos. "Maria João" e "MARIA JOAO " viram "maria joao".
 */
function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove diacritics
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  let body: { phone?: string; selectedName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const phone = normalizePhone(String(body.phone ?? ""));
  if (!phone) {
    return NextResponse.json(
      {
        error:
          "Telemóvel inválido. Formato: +244923456789 ou 923456789 (Angola)",
      },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // Localizar torneio pelo competition code
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name")
    .eq("padelteams_competition_code", code)
    .maybeSingle();
  if (!tournament) {
    return NextResponse.json(
      { error: "Torneio não encontrado" },
      { status: 404 },
    );
  }

  // Procurar jogadores com este telemóvel (pode haver mais de 1 — casais)
  const { data: contactsRaw } = await supabase
    .from("players_contacts")
    .select("name, category, gender")
    .eq("tournament_id", tournament.id)
    .eq("phone", phone);
  const contacts = contactsRaw ?? [];

  if (contacts.length === 0) {
    return NextResponse.json(
      {
        error:
          "Telemóvel não encontrado nas inscrições. Confirma o número ou contacta o clube.",
      },
      { status: 404 },
    );
  }

  // Se há mais de um e o frontend ainda não escolheu, devolve a lista
  const selectedName = body.selectedName?.trim();
  if (contacts.length > 1 && !selectedName) {
    return NextResponse.json({
      players: contacts.map((c) => ({
        name: c.name,
        category: c.category,
        gender: c.gender,
      })),
      selectedPlayer: null,
      games: [],
    });
  }

  // Escolhe o jogador certo (único, ou o que o frontend indicou)
  const player =
    contacts.length === 1
      ? contacts[0]!
      : contacts.find(
          (c) => normalizeName(c.name) === normalizeName(selectedName ?? ""),
        );

  if (!player) {
    return NextResponse.json(
      { error: "Jogador escolhido não corresponde aos registos" },
      { status: 400 },
    );
  }

  // Buscar snapshot do PadelTeams para encontrar os jogos deste jogador
  let snapshot: Awaited<ReturnType<typeof getCompetitionSnapshot>>;
  try {
    snapshot = await getCompetitionSnapshot(code);
  } catch (e) {
    return NextResponse.json(
      {
        error: "Falha a contactar PadelTeams",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 502 },
    );
  }

  // Match por nome: procurar jogos onde algum dos 4 jogadores tem nome
  // que normaliza para o mesmo que o nosso contacto.
  const playerNorm = normalizeName(player.name);
  const games = snapshot.games
    .filter((g) => {
      const allPlayerNames = [
        ...g.team1.players.map((p) => p.name),
        ...g.team2.players.map((p) => p.name),
      ];
      return allPlayerNames.some((n) => {
        const nn = normalizeName(n);
        // match exacto OU substring (caso o PadelTeams tenha nome mais
        // longo, ex: "Maria João Santos" vs nosso "Maria João")
        return nn === playerNorm || nn.includes(playerNorm) || playerNorm.includes(nn);
      });
    })
    .map((g) => ({
      id: g.id,
      scheduledAt: combineGameDateTime(g).toISOString(),
      field: g.field?.description ?? "—",
      teamA:
        g.team1.players.map((p) => p.name).join(" / ") || g.team1.name || "—",
      teamB:
        g.team2.players.map((p) => p.name).join(" / ") || g.team2.name || "—",
      status: g.status,
    }))
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() -
        new Date(b.scheduledAt).getTime(),
    );

  return NextResponse.json({
    players: contacts.map((c) => ({
      name: c.name,
      category: c.category,
      gender: c.gender,
    })),
    selectedPlayer: {
      name: player.name,
      category: player.category,
      gender: player.gender,
    },
    games,
  });
}
