/**
 * Transformações de alto-nível sobre o snapshot do PadelTeams:
 *  - filtrar jogos para um conjunto de fields (campos de um cavalete)
 *  - categorizar em "ao vivo agora" / "próximos" / "resultados de hoje"
 *  - converter para a shape consumida pela UI do cavalete
 */
import {
  combineGameDateTime,
  type PadelTeamsGame,
  type PadelTeamsPlayer,
} from "./client";

// ============================================================================
// SHAPES VIRADAS PARA A UI
// ============================================================================

export interface CavalettePlayer {
  /** id no PadelTeams (para lookup de photo override) */
  padelteamsId: number;
  name: string;
  /** photo a usar — null = não override (placeholder) */
  photoUrl: string | null;
}

export interface CavaletteTeam {
  padelteamsId: number;
  name: string;
  players: CavalettePlayer[];
}

export interface CavaletteGame {
  padelteamsId: number;
  startsAt: string; // ISO
  status: "open" | "closed";
  teamA: CavaletteTeam;
  teamB: CavaletteTeam;
  /** Score em sets — [{a, b, type}] */
  sets: { a: number; b: number; type: "set" | "tie" }[];
  /** Resumo "6-4 6-2" pronto a exibir */
  scoreLabel: string | null;
  /** Vencedor (1 = teamA, 2 = teamB, null = empate ou ainda em curso) */
  winner: 1 | 2 | null;
  /** Marcado is_featured pelo admin (entra com prioridade no carrossel) */
  isFeatured: boolean;
  /** Court associado (nosso id + nome) */
  court: { id: string; name: string } | null;
}

// ============================================================================
// HELPERS
// ============================================================================

function shortScore(sets: { a: number; b: number; type: "set" | "tie" }[]):
  | string
  | null {
  if (sets.length === 0) return null;
  return sets
    .map((s) => (s.type === "tie" ? `[${s.a}-${s.b}]` : `${s.a}-${s.b}`))
    .join(" ");
}

function decideWinner(
  sets: { a: number; b: number }[],
): 1 | 2 | null {
  if (sets.length === 0) return null;
  let a = 0;
  let b = 0;
  for (const s of sets) {
    if (s.a > s.b) a++;
    else if (s.b > s.a) b++;
  }
  if (a > b) return 1;
  if (b > a) return 2;
  return null;
}

/**
 * Converte um PadelTeamsPlayer para a shape do cavalete, aplicando lookup
 * de foto-override (mapa padelteams_player_id → photo_url do nosso DB).
 */
function transformPlayer(
  p: PadelTeamsPlayer,
  photoOverrides: Map<number, string>,
): CavalettePlayer {
  return {
    padelteamsId: p.id,
    name: p.name,
    photoUrl: photoOverrides.get(p.id) ?? null,
  };
}

/**
 * Transforma um PadelTeamsGame puro num CavaletteGame pronto para UI.
 */
export function transformGame(
  g: PadelTeamsGame,
  ctx: {
    photoOverrides: Map<number, string>;
    courtByFieldId: Map<number, { id: string; name: string }>;
    featuredGameIds: Set<number>;
  },
): CavaletteGame {
  const startsAt = combineGameDateTime(g).toISOString();
  const sets = g.results.map((r) => ({
    a: r.team1,
    b: r.team2,
    type: r.type,
  }));
  return {
    padelteamsId: g.id,
    startsAt,
    status: g.status,
    teamA: {
      padelteamsId: g.team1.id,
      name: g.team1.name,
      players: g.team1.players.map((p) =>
        transformPlayer(p, ctx.photoOverrides),
      ),
    },
    teamB: {
      padelteamsId: g.team2.id,
      name: g.team2.name,
      players: g.team2.players.map((p) =>
        transformPlayer(p, ctx.photoOverrides),
      ),
    },
    sets,
    scoreLabel: shortScore(sets),
    winner: decideWinner(sets),
    isFeatured: ctx.featuredGameIds.has(g.id),
    court: g.field ? ctx.courtByFieldId.get(g.field.id) ?? null : null,
  };
}

// ============================================================================
// CATEGORIZAÇÃO POR CAMPO
// ----------------------------------------------------------------------------
// Como o PadelTeams NÃO tem status "live", inferimos por hora:
//   "live agora" = jogo `open` mais recente cujo scheduled_at <= now()
//                  E não há outro jogo `open` no mesmo campo com
//                  scheduled_at posterior também já no passado.
//                  Ou seja, é o "mais à frente na fila" cujo tempo
//                  já passou.
//   "próximos"   = jogos `open` com scheduled_at > now(), por ordem.
//   "resultados" = jogos `closed` de HOJE, descendente (mais recente
//                  primeiro).
// ============================================================================

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export interface PerCourtBuckets {
  court: { id: string; name: string };
  live: CavaletteGame | null;
  upcoming: CavaletteGame[];
  results: CavaletteGame[];
}

/**
 * Para um court específico, categoriza os jogos do snapshot. Recebe os
 * jogos JÁ filtrados para o padelteams_field_id deste court.
 */
export function bucketCourtGames(
  court: { id: string; name: string },
  gamesOnThisCourt: CavaletteGame[],
  now: Date,
): PerCourtBuckets {
  const today = now;

  // Open games (futuros e atrasados)
  const open = gamesOnThisCourt
    .filter((g) => g.status === "open")
    .sort(
      (a, b) =>
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );

  // Heurística de "live now": o último open game cujo startsAt <= now
  const openInPast = open.filter((g) => new Date(g.startsAt) <= now);
  const live = openInPast.length > 0
    ? openInPast[openInPast.length - 1]
    : null;

  // Upcoming = open games no futuro (depois de now)
  const upcoming = open.filter((g) => new Date(g.startsAt) > now);

  // Results = closed games HOJE
  const results = gamesOnThisCourt
    .filter(
      (g) =>
        g.status === "closed" &&
        isSameDay(new Date(g.startsAt), today),
    )
    .sort(
      (a, b) =>
        new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
    );

  return { court, live, upcoming, results };
}

// ============================================================================
// PAYLOAD DO CAVALETE
// ============================================================================

export interface CavaletePayload {
  tournament: {
    name: string;
    /** Tempos de rotação configurados por torneio. Defaults: main 40s, sponsors 15s. */
    sceneDurations: {
      mainSec: number;
      sponsorsSec: number;
    };
  };
  cavalete: {
    name: string;
    courts: { id: string; name: string }[];
  };
  /** Por court (na mesma ordem de cavalete.courts): EM JOGO AGORA */
  liveByCourt: (CavaletteGame | null)[];
  /** Próximos jogos dos courts deste cavalete (interleaved, por tempo) */
  upcoming: CavaletteGame[];
  /** Resultados de hoje dos courts deste cavalete (mais recente primeiro) */
  results: CavaletteGame[];
  /** Jogos featured a decorrer agora — para carrossel "EM FOCO" */
  featured: CavaletteGame[];
  /** Sponsors do torneio */
  sponsors: {
    footer: { imageUrl: string }[];
    fullscreen: { imageUrl: string; durationSec: number }[];
  };
  /** Hora do servidor em ISO — para o cliente sincronizar relógio */
  serverTime: string;
}
