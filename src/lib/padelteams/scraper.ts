/**
 * Scraper da página pública do PadelTeams como fallback ao /v1/tournament/games
 * que devolve 500 (bug interno deles).
 *
 * URL pública: https://padelteams.pt/info/calendar?k=base64(cid=X&cur_day=YYYY-MM-DD&view=1)
 *
 * USADO APENAS PELO endpoint /api/pedidos/[code]/lookup. Cavaletes continuam
 * a usar o cliente REST /v1/* normal (que funciona para outras competições).
 *
 * Não usa libraries HTML — formato controlado, regex direto.
 */

import { getCompetition } from "./client";

const PUBLIC_BASE = "https://padelteams.pt";
const FETCH_TIMEOUT_MS = 10_000;

export interface PublicGame {
  /** ID interno do match no PadelTeams (do matchRowClick) */
  id: number;
  /** Snapshot do team A: jogadores separados por " / " */
  teamA: string;
  teamAPlayers: string[];
  /** Snapshot do team B */
  teamB: string;
  teamBPlayers: string[];
  /** Campo onde se joga (ex: "STANDARD BANK") */
  field: string;
  /** ISO timestamp local (YYYY-MM-DDTHH:MM:00) — sem timezone */
  scheduledAt: string;
  /** Cru: YYYY-MM-DD */
  date: string;
  /** Cru: HH:MM */
  time: string;
}

export interface PublicSnapshot {
  competitionId: number;
  competitionName: string;
  dateFrom: string;
  dateTo: string;
  games: PublicGame[];
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Cache em memória (mesmo TTL que o snapshot da API REST: 30s)
// ---------------------------------------------------------------------------
const cache = new Map<string, { value: PublicSnapshot; expiresAt: number }>();
const TTL_MS = 30_000;

function cacheGet(key: string): PublicSnapshot | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key: string, value: PublicSnapshot): void {
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

// ---------------------------------------------------------------------------
// FETCH
// ---------------------------------------------------------------------------
async function fetchPage(cid: number, dayISO: string): Promise<string> {
  // Base64 do payload "cid=X&cur_day=YYYY-MM-DD&view=1"
  const params = `cid=${cid}&cur_day=${dayISO}&view=1`;
  const k = Buffer.from(params, "utf-8").toString("base64");
  const url = `${PUBLIC_BASE}/info/calendar?k=${encodeURIComponent(k)}`;

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; PadescoreBot/1.0; +https://padescore)",
        Accept: "text/html",
      },
      signal: ac.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} a buscar ${url}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

// ---------------------------------------------------------------------------
// PARSER HTML
// ---------------------------------------------------------------------------

/** Limpa whitespace/newlines/tags inline da string de uma team-name. */
function cleanTeamName(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ") // remove tags inline (line-break, hidden-on-line-break)
    .replace(/\s+/g, " ")
    .trim();
}

/** Decode entidades HTML simples (&aacute; etc não acontecem aqui, mas safe). */
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/**
 * Parser do HTML do calendário do PadelTeams. O HTML está estruturado assim:
 *
 *   <a ...>251 - X | NOME_CAMPO</a>          <-- header da secção do campo
 *   ...
 *   <div onclick="matchRowClick('1351368')">  <-- 1 match no campo
 *     <div class="team-name">JOGADOR A1 / JOGADOR A2</div>
 *     <div class="team-name">JOGADOR B1 / JOGADOR B2</div>
 *     <div>251<br>1<br>13/06<br>08:00</div>
 *   </div>
 *   ...
 *   <a ...>251 - X+1 | OUTRO_CAMPO</a>       <-- próxima secção
 *
 * O parser:
 *   1. Faz split pelo regex do header de campo (capta nome do campo)
 *   2. Para cada secção, extrai os matches dentro (regex multilinha)
 *   3. Para cada match: id, 2 teams, hora
 */
function parseCalendarHtml(html: string, dayISO: string): PublicGame[] {
  const games: PublicGame[] = [];

  // 1. Identificar onde começam as secções de campo
  const fieldHeaderRe =
    /<a\s+class="fs-x text-base link"\s+href="[^"]*">[^<]*\|\s*([^<]+?)\s*<\/a>/g;

  // Encontra cada header de campo com a sua posição
  const fields: { name: string; start: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = fieldHeaderRe.exec(html)) !== null) {
    fields.push({ name: m[1]!.trim(), start: m.index + m[0].length });
  }
  if (fields.length === 0) return games;

  // 2. Para cada campo: secção = do início até ao próximo campo (ou fim)
  for (let i = 0; i < fields.length; i++) {
    const fieldName = fields[i]!.name;
    const start = fields[i]!.start;
    const end = i + 1 < fields.length ? fields[i + 1]!.start : html.length;
    const section = html.slice(start, end);

    // 3. Para cada match dentro da secção:
    //    onclick="matchRowClick('XXX')" ... team-name>A</> ... team-name>B</> ... HH:MM
    const matchRe =
      /onclick="matchRowClick\('(\d+)'\)"[\s\S]*?<div class="team-name[^"]*">\s*([\s\S]*?)\s*<\/div>[\s\S]*?<div class="team-name[^"]*">\s*([\s\S]*?)\s*<\/div>[\s\S]*?(\d{2}):(\d{2})\s*<\/div>/g;

    let mm: RegExpExecArray | null;
    while ((mm = matchRe.exec(section)) !== null) {
      const id = parseInt(mm[1]!, 10);
      const teamA = decodeHtmlEntities(cleanTeamName(mm[2]!));
      const teamB = decodeHtmlEntities(cleanTeamName(mm[3]!));
      const hh = mm[4]!;
      const mmTime = mm[5]!;
      if (!teamA || !teamB || !Number.isFinite(id)) continue;

      games.push({
        id,
        teamA,
        teamAPlayers: splitTeam(teamA),
        teamB,
        teamBPlayers: splitTeam(teamB),
        field: fieldName,
        scheduledAt: `${dayISO}T${hh}:${mmTime}:00`,
        date: dayISO,
        time: `${hh}:${mmTime}`,
      });
    }
  }

  return games;
}

function splitTeam(team: string): string[] {
  return team
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// DATE RANGE
// ---------------------------------------------------------------------------

/** Devolve array de YYYY-MM-DD entre from e to (inclusive). */
function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return out;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push(iso);
  }
  return out;
}

// ---------------------------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------------------------

/**
 * Obtém os jogos públicos de uma competição via HTML scraping.
 * Faz fetch da página pública por cada dia do range da competição.
 */
export async function getPublicCompetitionGames(
  code: string,
): Promise<PublicSnapshot> {
  const cacheKey = `pub::${code}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  // Vai buscar id + datas da competição via API REST (esse endpoint funciona)
  const comp = await getCompetition(code);
  const days = dateRange(comp.date_from, comp.date_to);

  // Fetch das páginas em paralelo (uma por dia)
  const pages = await Promise.all(
    days.map(async (day) => {
      try {
        const html = await fetchPage(comp.id, day);
        return parseCalendarHtml(html, day);
      } catch (err) {
        console.warn(
          `[PadelTeams scraper] falha a buscar ${day}:`,
          err instanceof Error ? err.message : err,
        );
        return [] as PublicGame[];
      }
    }),
  );

  // Dedupe por id (cada match pode aparecer em vários campos visualmente?
  // Por segurança, mantém o primeiro)
  const seen = new Set<number>();
  const games: PublicGame[] = [];
  for (const day of pages) {
    for (const g of day) {
      if (seen.has(g.id)) continue;
      seen.add(g.id);
      games.push(g);
    }
  }

  // Ordena por data ascending
  games.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  const snapshot: PublicSnapshot = {
    competitionId: comp.id,
    competitionName: comp.name,
    dateFrom: comp.date_from,
    dateTo: comp.date_to,
    games,
    fetchedAt: new Date().toISOString(),
  };
  cacheSet(cacheKey, snapshot);
  return snapshot;
}
