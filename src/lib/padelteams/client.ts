/**
 * Cliente HTTP para a API protegida do PadelTeams.
 *
 *   docs: o organizador recebe via e-mail; endpoints relevantes para nós:
 *     GET /v1/competition/view?code=<CODE>
 *     GET /v1/competition/tournaments?id=<COMPETITION_ID>
 *     GET /v1/tournament/games?id=<TOURNAMENT_ID>
 *
 *   auth: Bearer token em env var `PADELTEAMS_BEARER_TOKEN`.
 *         Mesmo token para todas as competições da mesma conta.
 *
 *   cache: in-memory por chave-de-pedido, TTL 30s por defeito (configurável
 *          via env PADELTEAMS_CACHE_TTL_MS). Evita martelar a API deles e
 *          ainda permite ao cavalete fazer poll a cada 15s sem custo extra.
 *
 *   normalização: corrigimos o mojibake típico (Ã© → é) que vem nos nomes
 *          com acentos, e juntamos date+time em ISO local para facilitar
 *          ordenação cronológica.
 *
 *   importante: este módulo é PURO SERVER (usa fetch + env vars). Não
 *               importar do código de cliente — usar via /api/cavalete.
 */

const API_BASE = "https://protected.padelteams.pt/v1";
const DEFAULT_CACHE_TTL_MS = 30_000;
const FETCH_TIMEOUT_MS = 10_000;

// ============================================================================
// TIPOS — espelham a shape da API PadelTeams (post-normalização)
// ============================================================================

export interface PadelTeamsCompetition {
  id: number;
  name: string;
  description: string;
  date_from: string; // YYYY-MM-DD
  date_to: string; // YYYY-MM-DD
}

export interface PadelTeamsTournament {
  id: number;
  name: string; // ex: "M1", "F2", "MX1"
  players_gender: "M" | "F" | "X";
  ranking_level: string;
}

export interface PadelTeamsField {
  id: number;
  name: string; // ex: "ALPROME"
  description: string; // ex: "Campo 2"
  clubeCode: string;
}

export interface PadelTeamsPlayer {
  id: number;
  name: string;
  photo: string; // placeholder URL geralmente; ignoramos e usamos a nossa
}

export interface PadelTeamsTeam {
  id: number;
  name: string; // "Player A / Player B"
  players: PadelTeamsPlayer[];
}

export interface PadelTeamsResult {
  team1: number;
  team2: number;
  type: "set" | "tie";
}

export interface PadelTeamsGame {
  id: number;
  phase_id: number;
  group_id: number;
  team1: PadelTeamsTeam;
  team2: PadelTeamsTeam;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM:SS
  status: "open" | "closed";
  results: PadelTeamsResult[];
  field: PadelTeamsField | null; // pode faltar em torneios antigos
}

/** Snapshot completo: competição + todos os jogos de todos os tournaments. */
export interface PadelTeamsSnapshot {
  competition: PadelTeamsCompetition;
  tournaments: PadelTeamsTournament[];
  games: PadelTeamsGame[];
  fetchedAt: string; // ISO timestamp
}

// ============================================================================
// CACHE — Map<key, {value, expiresAt}> simples in-memory
// ============================================================================

const cache = new Map<string, { value: unknown; expiresAt: number }>();

function cacheTtl(): number {
  const env = process.env.PADELTEAMS_CACHE_TTL_MS;
  if (!env) return DEFAULT_CACHE_TTL_MS;
  const parsed = parseInt(env, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CACHE_TTL_MS;
}

function cacheGet<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value as T;
}

function cacheSet(key: string, value: unknown): void {
  cache.set(key, { value, expiresAt: Date.now() + cacheTtl() });
}

/** Invalida cache (manual override em mudanças do admin). */
export function invalidatePadelTeamsCache(prefix?: string): number {
  if (!prefix) {
    const n = cache.size;
    cache.clear();
    return n;
  }
  let n = 0;
  for (const k of cache.keys()) {
    if (k.startsWith(prefix)) {
      cache.delete(k);
      n++;
    }
  }
  return n;
}

// ============================================================================
// HTTP CORE
// ============================================================================

class PadelTeamsError extends Error {
  constructor(
    public status: number,
    public url: string,
    message: string,
  ) {
    super(`[PadelTeams ${status}] ${url}: ${message}`);
    this.name = "PadelTeamsError";
  }
}

async function rawFetch<T>(path: string): Promise<T> {
  const token = process.env.PADELTEAMS_BEARER_TOKEN;
  if (!token) {
    throw new Error(
      "Falta env var PADELTEAMS_BEARER_TOKEN — configura no .env.local",
    );
  }

  const url = `${API_BASE}${path}`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: ac.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new PadelTeamsError(res.status, url, body.slice(0, 200));
    }

    const json = (await res.json()) as T;
    return json;
  } finally {
    clearTimeout(t);
  }
}

/** Wrapper com cache por path completo. */
async function cachedFetch<T>(path: string): Promise<T> {
  const cached = cacheGet<T>(path);
  if (cached !== null) return cached;
  const fresh = await rawFetch<T>(path);
  cacheSet(path, fresh);
  return fresh;
}

// ============================================================================
// MOJIBAKE FIX
// ----------------------------------------------------------------------------
// O PadelTeams devolve nomes acentuados em double-encoded UTF-8:
//   bytes UTF-8 de "é" (0xC3 0xA9) interpretados como Latin-1 dão "Ã©"
//
// Aplicamos só se detectarmos o padrão típico (Ã + qualquer char), porque
// o "fix" sobre uma string já correcta destrói os caracteres.
// ============================================================================

const MOJIBAKE_HINT = /Ã[-¿]/; // Ã seguido de char em range alto

export function fixMojibake(s: string): string {
  if (!s || !MOJIBAKE_HINT.test(s)) return s;
  try {
    const bytes = new Uint8Array([...s].map((c) => c.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return decoded;
  } catch {
    return s; // se falhar, devolve original (não pior que aceitar)
  }
}

function fixPlayer(p: PadelTeamsPlayer): PadelTeamsPlayer {
  return { ...p, name: fixMojibake(p.name) };
}

function fixTeam(t: PadelTeamsTeam): PadelTeamsTeam {
  return {
    ...t,
    name: fixMojibake(t.name),
    players: t.players.map(fixPlayer),
  };
}

function fixGame(g: PadelTeamsGame): PadelTeamsGame {
  return {
    ...g,
    team1: fixTeam(g.team1),
    team2: fixTeam(g.team2),
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

export async function getCompetition(
  code: string,
): Promise<PadelTeamsCompetition> {
  return cachedFetch<PadelTeamsCompetition>(
    `/competition/view?code=${encodeURIComponent(code)}`,
  );
}

export async function getCompetitionTournaments(
  competitionId: number,
): Promise<{
  competition: PadelTeamsCompetition;
  tournaments: PadelTeamsTournament[];
}> {
  return cachedFetch(`/competition/tournaments?id=${competitionId}`);
}

export async function getTournamentGames(
  tournamentId: number,
): Promise<PadelTeamsGame[]> {
  const raw = await cachedFetch<PadelTeamsGame[]>(
    `/tournament/games?id=${tournamentId}`,
  );
  return raw.map(fixGame);
}

/**
 * Atalho de alto-nível: dado o `code` da competição, devolve um snapshot
 * com TODOS os jogos de TODOS os tournaments (M1/F1/M2/F2/...).
 *
 * Implementação: 2 requests em série (competition + tournaments) seguidos
 * de N requests paralelos (1 por tournament). Todos cacheados.
 *
 * O snapshot completo é também cacheado pela mesma TTL — assim, o cavalete
 * que faz poll de 15s só pega às vezes em chamadas reais à API PadelTeams.
 */
export async function getCompetitionSnapshot(
  code: string,
): Promise<PadelTeamsSnapshot> {
  const cacheKey = `__snapshot__/${code}`;
  const cached = cacheGet<PadelTeamsSnapshot>(cacheKey);
  if (cached) return cached;

  const competition = await getCompetition(code);
  const { tournaments } = await getCompetitionTournaments(competition.id);

  // Resilient: tournaments sem draws ainda criados retornam 500 do PadelTeams.
  // Em vez de fail-all, fazemos skip do tournament problemático e continuamos
  // com os que funcionam. Pré-evento (sem nenhum draw) → games=[] mas snapshot
  // válido com competition + tournaments info.
  const gamesPerTournament = await Promise.all(
    tournaments.map((t) =>
      getTournamentGames(t.id).catch((err) => {
        // Log silencioso (server-side). Não interrompe os outros tournaments.
        console.warn(
          `[PadelTeams snapshot] skip tournament ${t.id} (${t.name}):`,
          err instanceof Error ? err.message : err,
        );
        return [] as PadelTeamsGame[];
      }),
    ),
  );
  const games = gamesPerTournament.flat();

  const snapshot: PadelTeamsSnapshot = {
    competition,
    tournaments,
    games,
    fetchedAt: new Date().toISOString(),
  };
  cacheSet(cacheKey, snapshot);
  return snapshot;
}

// ============================================================================
// HELPERS DE TEMPO
// ============================================================================

/**
 * Combina `date` (YYYY-MM-DD) + `time` (HH:MM:SS) num timestamp.
 * O PadelTeams devolve os tempos em hora LOCAL do torneio (Angola, WAT =
 * UTC+1, sem horário de verão) e SEM offset. Marcamos o offset de Angola
 * explicitamente — senão `new Date` interpreta a string no fuso do processo
 * (UTC no servidor Docker) e o instante fica 1h errado, fazendo os jogos
 * aparecerem +1h no cavalete.
 */
export const ANGOLA_OFFSET = "+01:00";

export function combineGameDateTime(game: PadelTeamsGame): Date {
  return new Date(`${game.date}T${game.time}${ANGOLA_OFFSET}`);
}
