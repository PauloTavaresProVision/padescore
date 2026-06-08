import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicCompetitionGames } from "@/lib/padelteams/scraper";

export const dynamic = "force-dynamic";

/**
 * POST /api/pedidos/[code]/lookup
 *
 * Endpoint público. Identifica o jogador pelo telemóvel OU email e
 * devolve os jogos em que está envolvido (matching por nome com o
 * snapshot PadelTeams).
 *
 * Body: { phone: "+244923456789" }  ou  { email: "x@y.com" }
 *        (ou identifier — auto-detect se contém @)
 *
 * Response 200 (1 jogador):
 *   {
 *     players: [{ name, category }],
 *     selectedPlayer: { name, category },
 *     games: [{ id, scheduledAt, field, teamA, teamB, ... }]
 *   }
 *
 * Response 200 (vários jogadores no mesmo contacto — casais que partilham):
 *   {
 *     players: [{ name, category }, { name, category }],
 *     selectedPlayer: null,  // frontend mostra dropdown
 *     games: []
 *   }
 *
 * Response 404: identificador não inscrito neste torneio.
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

  let body: {
    phone?: string;
    email?: string;
    identifier?: string;
    selectedName?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  // Auto-detect: se `identifier` contém '@' → email; senão → phone.
  // Aceitar também phone/email explícitos como fallback.
  const rawIdentifier = (body.identifier ?? "").trim();
  let lookupEmail: string | null = null;
  let lookupPhone: string | null = null;

  if (body.email) {
    lookupEmail = String(body.email).trim().toLowerCase();
  } else if (body.phone) {
    lookupPhone = normalizePhone(String(body.phone));
  } else if (rawIdentifier) {
    if (rawIdentifier.includes("@")) {
      lookupEmail = rawIdentifier.toLowerCase();
    } else {
      lookupPhone = normalizePhone(rawIdentifier);
    }
  }

  if (!lookupPhone && !lookupEmail) {
    return NextResponse.json(
      {
        error:
          "Identificador inválido. Indica telemóvel (ex: 923456789) ou email.",
      },
      { status: 400 },
    );
  }

  // Validar formato email se foi essa a escolha
  if (lookupEmail && !/^\S+@\S+\.\S+$/.test(lookupEmail)) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 });
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

  // Procurar jogadores pelo telemóvel OU email (case-insensitive no email)
  let query = supabase
    .from("players_contacts")
    .select("name, phone, email, category, gender")
    .eq("tournament_id", tournament.id);
  if (lookupPhone) {
    query = query.eq("phone", lookupPhone);
  } else if (lookupEmail) {
    // ilike para case-insensitive — emails são case-insensitive no domain
    query = query.ilike("email", lookupEmail);
  }
  const { data: contactsRaw } = await query;
  const contacts = contactsRaw ?? [];

  if (contacts.length === 0) {
    return NextResponse.json(
      {
        error: lookupEmail
          ? "Email não encontrado nas inscrições. Verifica ou contacta o clube."
          : "Telemóvel não encontrado nas inscrições. Confirma o número ou contacta o clube.",
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

  // Buscar jogos da página pública do PadelTeams (HTML scraping —
  // workaround porque a API REST /v1/tournament/games retorna 500).
  // Snapshot cacheado 30s.
  let snapshot: Awaited<ReturnType<typeof getPublicCompetitionGames>>;
  try {
    snapshot = await getPublicCompetitionGames(code);
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
      const allPlayerNames = [...g.teamAPlayers, ...g.teamBPlayers];
      return allPlayerNames.some((n) => {
        const nn = normalizeName(n);
        return (
          nn === playerNorm || nn.includes(playerNorm) || playerNorm.includes(nn)
        );
      });
    })
    .map((g) => ({
      id: g.id,
      scheduledAt: g.scheduledAt,
      field: g.field,
      teamA: g.teamA,
      teamB: g.teamB,
      status: "open" as const,
    }))
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

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
      // Devolvido para o frontend usar no submit do pedido (que precisa
      // sempre de telemóvel, mesmo quando o jogador se identificou por email)
      phone: player.phone,
      email: player.email,
    },
    games,
    // Datas do torneio (para o dropdown de "Disponível no dia X")
    competitionDates: {
      from: snapshot.dateFrom,
      to: snapshot.dateTo,
    },
  });
}
