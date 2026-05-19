import type { SupabaseClient } from "@supabase/supabase-js";
import { applyEvent, initialState, reduceEvents } from "./engine";
import type { MatchConfig, MatchEvent, MatchState, TeamSide } from "./types";

interface MatchRow {
  id: string;
  golden_point: boolean;
  sets_to_win: number;
  games_per_set: number;
  tiebreak_at: number;
  tiebreak_points: number;
  final_set_super_tiebreak: boolean;
}

export function configFromMatch(m: MatchRow): MatchConfig {
  return {
    goldenPoint: m.golden_point,
    setsToWin: m.sets_to_win,
    gamesPerSet: m.games_per_set,
    tiebreakAt: m.tiebreak_at,
    tiebreakPoints: m.tiebreak_points,
    finalSetSuperTiebreak: m.final_set_super_tiebreak,
  };
}

interface DbStateRow {
  points_a: string;
  points_b: string;
  games_a: number;
  games_b: number;
  sets_a: number;
  sets_b: number;
  sets_history: { a: number; b: number }[];
  server: TeamSide;
  in_tiebreak: boolean;
  in_super_tiebreak: boolean;
  is_finished: boolean;
  winner: TeamSide | null;
  last_event_seq: number;
}

export function stateFromDb(row: DbStateRow): MatchState {
  return {
    pointsA: row.points_a,
    pointsB: row.points_b,
    gamesA: row.games_a,
    gamesB: row.games_b,
    setsA: row.sets_a,
    setsB: row.sets_b,
    setsHistory: row.sets_history ?? [],
    server: row.server,
    inTiebreak: row.in_tiebreak,
    inSuperTiebreak: row.in_super_tiebreak,
    isFinished: row.is_finished,
    winner: row.winner,
  };
}

function stateToDb(state: MatchState, lastSeq: number) {
  return {
    points_a: state.pointsA,
    points_b: state.pointsB,
    games_a: state.gamesA,
    games_b: state.gamesB,
    sets_a: state.setsA,
    sets_b: state.setsB,
    sets_history: state.setsHistory,
    server: state.server,
    in_tiebreak: state.inTiebreak,
    in_super_tiebreak: state.inSuperTiebreak,
    is_finished: state.isFinished,
    winner: state.winner,
    last_event_seq: lastSeq,
    updated_at: new Date().toISOString(),
  };
}

interface DbEvent {
  id: number;
  seq: number;
  type: "point" | "undo" | "manual";
  team: TeamSide | null;
  payload: Partial<MatchState> | null;
  voided: boolean;
}

function computeFromEvents(events: DbEvent[], config: MatchConfig): MatchState {
  const active = events.filter((e) => !e.voided && e.type !== "undo");
  const evts: MatchEvent[] = active.map((e) =>
    e.type === "manual"
      ? { type: "manual", payload: e.payload ?? {} }
      : { type: "point", team: e.team! },
  );
  return reduceEvents(evts, config);
}

interface ApplyResult {
  ok: true;
  state: MatchState;
  seq: number;
}
interface ApplyError {
  ok: false;
  error: string;
}

const MATCH_COLS =
  "id, status, started_at, finished_at, golden_point, sets_to_win, games_per_set, tiebreak_at, tiebreak_points, final_set_super_tiebreak";

/**
 * Aplica um evento a um jogo. Optimizado para "point" (caminho rápido):
 *   - 1 round-trip de leitura: match + match_state em paralelo
 *   - 1 round-trip de escrita: insert event + update state em paralelo
 *
 * Operações como undo, undo_last_game, undo_last_set, swap_server e manual
 * recomputam do log de eventos (slow path).
 */
export type ApplyEventInput =
  | { type: "point"; team: TeamSide }
  | { type: "undo" }
  | { type: "undo_last_game" }
  | { type: "undo_last_set" }
  | { type: "swap_server" }
  | { type: "manual"; payload: Partial<MatchState> };

export async function applyMatchEvent(
  supabase: SupabaseClient,
  matchId: string,
  event: ApplyEventInput,
): Promise<ApplyResult | ApplyError> {
  // Retry on seq conflict — acontece quando dois requests concorrentes lêem
  // o mesmo `last_event_seq` e tentam inserir o mesmo seq. Cada retry lê o
  // estado fresco e recalcula.
  const MAX_RETRIES = 5;
  let last: ApplyError = { ok: false, error: "Falha desconhecida." };
  for (let i = 0; i < MAX_RETRIES; i++) {
    const result = await applyOnce(supabase, matchId, event);
    if (result.ok) return result;
    if (!isSeqConflict(result.error)) return result;
    last = result;
    // Backoff curto (jitter para evitar lockstep)
    await sleep(15 + i * 10 + Math.random() * 15);
  }
  return last;
}

async function applyOnce(
  supabase: SupabaseClient,
  matchId: string,
  event: ApplyEventInput,
): Promise<ApplyResult | ApplyError> {
  if (event.type === "point") {
    return applyPointFast(supabase, matchId, event.team);
  }
  if (event.type === "swap_server") {
    return swapServerFast(supabase, matchId);
  }
  if (event.type === "undo_last_game" || event.type === "undo_last_set") {
    return undoToLevel(supabase, matchId, event.type === "undo_last_game" ? "game" : "set");
  }
  return applyFromEventLog(supabase, matchId, event);
}

function isSeqConflict(err: string | undefined): boolean {
  if (!err) return false;
  const e = err.toLowerCase();
  return (
    e.includes("match_events_match_id_seq_key") ||
    e.includes("duplicate key") ||
    e.includes("violates unique constraint")
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// -------------------------------------------------------------------------
// Fast path: swap server — toggle simples sem recomputar tudo
// -------------------------------------------------------------------------
async function swapServerFast(
  supabase: SupabaseClient,
  matchId: string,
): Promise<ApplyResult | ApplyError> {
  const [{ data: stateRow, error: stateErr }, maxSeqRes] = await Promise.all([
    supabase.from("match_state").select("*").eq("match_id", matchId).single(),
    supabase
      .from("match_events")
      .select("seq")
      .eq("match_id", matchId)
      .order("seq", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (stateErr || !stateRow) {
    return { ok: false, error: stateErr?.message ?? "Estado não encontrado" };
  }

  const newServer: TeamSide = stateRow.server === "A" ? "B" : "A";
  const maxEventSeq =
    !maxSeqRes.error && maxSeqRes.data ? (maxSeqRes.data.seq as number) : 0;
  const nextSeq = Math.max(maxEventSeq, stateRow.last_event_seq ?? 0) + 1;

  const insRes = await supabase.from("match_events").insert({
    match_id: matchId,
    seq: nextSeq,
    type: "manual",
    payload: { server: newServer },
  });
  if (insRes.error) return { ok: false, error: insRes.error.message };

  const updRes = await supabase
    .from("match_state")
    .update({
      server: newServer,
      last_event_seq: nextSeq,
      updated_at: new Date().toISOString(),
    })
    .eq("match_id", matchId);
  if (updRes.error) return { ok: false, error: updRes.error.message };

  const newState = { ...stateFromDb(stateRow as DbStateRow), server: newServer };
  return { ok: true, state: newState, seq: nextSeq };
}

// -------------------------------------------------------------------------
// Undo to game/set boundary
// -------------------------------------------------------------------------
type UndoLevel = "game" | "set";

async function undoToLevel(
  supabase: SupabaseClient,
  matchId: string,
  level: UndoLevel,
): Promise<ApplyResult | ApplyError> {
  const [matchRes, eventsRes] = await Promise.all([
    supabase.from("matches").select(MATCH_COLS).eq("id", matchId).single(),
    supabase
      .from("match_events")
      .select("id, seq, type, team, payload, voided")
      .eq("match_id", matchId)
      .order("seq", { ascending: true }),
  ]);

  if (matchRes.error || !matchRes.data) {
    return { ok: false, error: matchRes.error?.message ?? "Jogo não encontrado" };
  }
  if (eventsRes.error) return { ok: false, error: eventsRes.error.message };

  const config = configFromMatch(matchRes.data);
  const allEvents = (eventsRes.data ?? []) as DbEvent[];
  const active = allEvents.filter((e) => !e.voided && e.type !== "undo");

  // Replay para obter os estados intermédios
  const stateAt: MatchState[] = [];
  let s = initialState();
  stateAt.push(s);
  for (const e of active) {
    const ev: MatchEvent =
      e.type === "manual"
        ? { type: "manual", payload: e.payload ?? {} }
        : { type: "point", team: e.team! };
    s = applyEvent(s, ev, config);
    stateAt.push(s);
  }

  const finalState = stateAt[stateAt.length - 1];
  const currentTotalGames = totalGamesPlayed(finalState);
  const currentTotalSets = finalState.setsA + finalState.setsB;

  let targetIndex = -1;

  if (level === "game") {
    // Reverte SEMPRE para "um game concluído a menos".
    // Se houver actividade parcial num game novo, é tudo limpo junto.
    const targetTotal = currentTotalGames - 1;

    if (targetTotal < 0) {
      return { ok: false, error: "Não há games para desfazer." };
    }

    for (let k = stateAt.length - 1; k >= 0; k--) {
      const st = stateAt[k];
      if (
        totalGamesPlayed(st) === targetTotal &&
        st.pointsA === "0" &&
        st.pointsB === "0"
      ) {
        targetIndex = k;
        break;
      }
    }
  } else {
    // set — reverte sempre um set concluído (mais qualquer actividade parcial)
    const targetTotal = currentTotalSets - 1;

    if (targetTotal < 0) {
      return { ok: false, error: "Não há sets para desfazer." };
    }

    for (let k = stateAt.length - 1; k >= 0; k--) {
      const st = stateAt[k];
      if (
        st.setsA + st.setsB === targetTotal &&
        st.gamesA === 0 &&
        st.gamesB === 0 &&
        st.pointsA === "0" &&
        st.pointsB === "0"
      ) {
        targetIndex = k;
        break;
      }
    }
  }

  if (targetIndex < 0) {
    return { ok: false, error: "Não foi possível encontrar ponto de retorno." };
  }
  if (targetIndex === active.length) {
    return { ok: false, error: "Nada para desfazer." };
  }

  // Eventos a anular: active[targetIndex..] (todos os eventos activos a partir
  // desse índice).
  const toVoidIds = active.slice(targetIndex).map((e) => e.id);

  const nextSeq = (allEvents.at(-1)?.seq ?? 0) + 1;

  const { data: undoRow, error: insErr } = await supabase
    .from("match_events")
    .insert({
      match_id: matchId,
      seq: nextSeq,
      type: "undo",
      payload: { level },
    })
    .select("id")
    .single();
  if (insErr) return { ok: false, error: insErr.message };

  const { error: voidErr } = await supabase
    .from("match_events")
    .update({ voided: true, voided_by: undoRow!.id })
    .in("id", toVoidIds);
  if (voidErr) return { ok: false, error: voidErr.message };

  const targetState = stateAt[targetIndex];
  const { error: stateErr } = await supabase
    .from("match_state")
    .update(stateToDb(targetState, nextSeq))
    .eq("match_id", matchId);
  if (stateErr) return { ok: false, error: stateErr.message };

  // Se o jogo estava terminado e estamos a desfazer, volta a live
  if (matchRes.data.status === "finished" && !targetState.isFinished) {
    await supabase
      .from("matches")
      .update({ status: "live", finished_at: null })
      .eq("id", matchId);
  }

  return { ok: true, state: targetState, seq: nextSeq };
}

function totalGamesPlayed(state: MatchState): number {
  const inHistory = state.setsHistory.reduce((s, h) => s + h.a + h.b, 0);
  return inHistory + state.gamesA + state.gamesB;
}

/**
 * Mantém a linha `matches` em sincronia com o estado calculado:
 *   - Se ainda não tem `started_at` (primeiro ponto), marca-o.
 *   - Se terminou e ainda não tem `finished_at`, marca-o.
 *
 * É SÍNCRONO (await) porque a fila de pedidos do operador já serializa,
 * e a latência adicional acontece só nas transições (1ª e última), não em
 * cada ponto.
 */
async function updateMatchStatusIfNeeded(
  supabase: SupabaseClient,
  matchId: string,
  current: { status: string; started_at: string | null; finished_at: string | null },
  newState: MatchState,
) {
  const patch: Record<string, unknown> = {};

  if (current.started_at === null && !newState.isFinished) {
    patch.status = "live";
    patch.started_at = new Date().toISOString();
  }

  if (newState.isFinished && current.finished_at === null) {
    patch.status = "finished";
    patch.finished_at = new Date().toISOString();
    if (current.started_at === null) {
      patch.started_at = new Date().toISOString();
    }
  }

  if (Object.keys(patch).length === 0) return;

  await supabase.from("matches").update(patch).eq("id", matchId);
}

// -------------------------------------------------------------------------
// Fast path: point — sem ler todos os eventos
// -------------------------------------------------------------------------
async function applyPointFast(
  supabase: SupabaseClient,
  matchId: string,
  team: TeamSide,
): Promise<ApplyResult | ApplyError> {
  const [matchRes, stateRes, maxSeqRes] = await Promise.all([
    supabase.from("matches").select(MATCH_COLS).eq("id", matchId).single(),
    supabase.from("match_state").select("*").eq("match_id", matchId).single(),
    supabase
      .from("match_events")
      .select("seq")
      .eq("match_id", matchId)
      .order("seq", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (matchRes.error || !matchRes.data) {
    return { ok: false, error: matchRes.error?.message ?? "Jogo não encontrado" };
  }
  if (stateRes.error || !stateRes.data) {
    return { ok: false, error: stateRes.error?.message ?? "Estado não encontrado" };
  }

  const config = configFromMatch(matchRes.data);
  const current = stateFromDb(stateRes.data as DbStateRow);

  if (current.isFinished) {
    return { ok: false, error: "Jogo já terminou." };
  }

  const newState = applyEvent(current, { type: "point", team }, config);
  // Seq autoritativo: o MAIOR entre o seq real dos eventos e o last_event_seq
  // do estado. Auto-cura drift (correções manuais/undo deixaram o estado
  // atrás do log) sem reset — a unique constraint + retry tratam da
  // concorrência genuína.
  const maxEventSeq =
    !maxSeqRes.error && maxSeqRes.data ? (maxSeqRes.data.seq as number) : 0;
  const nextSeq =
    Math.max(maxEventSeq, stateRes.data.last_event_seq ?? 0) + 1;

  // Sequencial: insert primeiro (a unique constraint em (match_id, seq)
  // serializa cliques concorrentes — só um vence o seq). Só se passar,
  // fazemos o update do estado.
  const insRes = await supabase
    .from("match_events")
    .insert({ match_id: matchId, seq: nextSeq, type: "point", team });
  if (insRes.error) return { ok: false, error: insRes.error.message };

  const updRes = await supabase
    .from("match_state")
    .update(stateToDb(newState, nextSeq))
    .eq("match_id", matchId);
  if (updRes.error) return { ok: false, error: updRes.error.message };

  await updateMatchStatusIfNeeded(supabase, matchId, matchRes.data, newState);

  return { ok: true, state: newState, seq: nextSeq };
}

// -------------------------------------------------------------------------
// Slow path: undo / manual — recomputa do log de eventos
// -------------------------------------------------------------------------
async function applyFromEventLog(
  supabase: SupabaseClient,
  matchId: string,
  event: { type: "undo" } | { type: "manual"; payload: Partial<MatchState> },
): Promise<ApplyResult | ApplyError> {
  const matchPromise = supabase
    .from("matches")
    .select(MATCH_COLS)
    .eq("id", matchId)
    .single();
  const eventsPromise = supabase
    .from("match_events")
    .select("id, seq, type, team, payload, voided")
    .eq("match_id", matchId)
    .order("seq", { ascending: true });

  const [matchRes, eventsRes] = await Promise.all([matchPromise, eventsPromise]);

  if (matchRes.error || !matchRes.data) {
    return { ok: false, error: matchRes.error?.message ?? "Jogo não encontrado" };
  }
  if (eventsRes.error) return { ok: false, error: eventsRes.error.message };

  const config = configFromMatch(matchRes.data);
  const list = (eventsRes.data ?? []) as DbEvent[];
  const nextSeq = (list.at(-1)?.seq ?? 0) + 1;

  if (event.type === "undo") {
    const lastActive = [...list].reverse().find((e) => !e.voided && e.type !== "undo");
    if (!lastActive) return { ok: false, error: "Nada para desfazer." };

    const { data: undoRow, error: insErr } = await supabase
      .from("match_events")
      .insert({ match_id: matchId, seq: nextSeq, type: "undo" })
      .select("id")
      .single();
    if (insErr) return { ok: false, error: insErr.message };

    const { error: voidErr } = await supabase
      .from("match_events")
      .update({ voided: true, voided_by: undoRow!.id })
      .eq("id", lastActive.id);
    if (voidErr) return { ok: false, error: voidErr.message };

    lastActive.voided = true;
    // Push o evento undo para a lista local — sem isto, o `list.at(-1)?.seq`
    // mais abaixo devolve o seq do ponto anterior e o match_state.last_event_seq
    // fica desactualizado → próximo `applyPointFast` calcula um nextSeq que
    // colide com o seq deste undo.
    list.push({
      id: undoRow!.id,
      seq: nextSeq,
      type: "undo",
      team: null,
      payload: null,
      voided: false,
    });
  } else {
    const { error: insErr } = await supabase
      .from("match_events")
      .insert({ match_id: matchId, seq: nextSeq, type: "manual", payload: event.payload });
    if (insErr) return { ok: false, error: insErr.message };
    list.push({ id: -1, seq: nextSeq, type: "manual", team: null, payload: event.payload, voided: false });
  }

  const newState = computeFromEvents(list, config);
  const lastSeq = list.at(-1)?.seq ?? 0;

  const { error: stateErr } = await supabase
    .from("match_state")
    .update(stateToDb(newState, lastSeq))
    .eq("match_id", matchId);
  if (stateErr) return { ok: false, error: stateErr.message };

  await updateMatchStatusIfNeeded(supabase, matchId, matchRes.data, newState);

  return { ok: true, state: newState, seq: lastSeq };
}
