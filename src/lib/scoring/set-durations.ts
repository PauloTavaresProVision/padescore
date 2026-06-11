import type { SupabaseClient } from "@supabase/supabase-js";
import type { MatchConfig, MatchEvent, MatchState, TeamSide } from "./types";
import { applyEvent, initialState } from "./engine";

export interface SetDurations {
  /** Duração (segundos) de cada set JÁ TERMINADO, por ordem. */
  completed: number[];
  /** Duração (segundos) do set em curso, ou null se o jogo acabou / nem começou. */
  current: number | null;
}

interface EventRow {
  seq: number;
  type: "point" | "undo" | "manual";
  team: TeamSide | null;
  payload: Partial<MatchState> | null;
  voided: boolean;
  created_at: string;
}

/**
 * Reconstrói a duração de cada set a partir do log de pontos (`match_events`).
 *
 * Não há timestamp por set guardado, mas cada ponto tem `created_at`. Fazendo
 * replay do motor de scoring, o instante em que `setsHistory` cresce é o fim
 * desse set. A duração de um set = (fim desse set) − (fim do set anterior),
 * sendo o "fim do set anterior" o `started_at` para o 1.º set.
 *
 * Barato: um jogo tem ~150–250 pontos; o replay é trivial. Corre a cada
 * request (o cartão faz polling), por isso o set em curso "anda" sozinho.
 */
export async function resolveSetDurations(
  supabase: SupabaseClient,
  matchId: string,
  config: MatchConfig,
  startedAt: string | null,
  finishedAt: string | null,
  serverNow: number,
): Promise<SetDurations> {
  const { data } = await supabase
    .from("match_events")
    .select("seq, type, team, payload, voided, created_at")
    .eq("match_id", matchId)
    .order("seq", { ascending: true });

  const rows = (data ?? []) as EventRow[];
  // Pontos válidos (descarta undos e eventos anulados), preservando created_at.
  const active = rows.filter((e) => !e.voided && e.type !== "undo");
  if (active.length === 0) return { completed: [], current: null };

  // Replay: regista o created_at do evento que FECHA cada set.
  let state: MatchState = initialState();
  const setEndMs: number[] = [];
  for (const e of active) {
    const ev: MatchEvent =
      e.type === "manual"
        ? { type: "manual", payload: e.payload ?? {} }
        : { type: "point", team: e.team! };
    state = applyEvent(state, ev, config);
    const t = new Date(e.created_at).getTime();
    // `while` (não `if`) caso um evento manual feche mais do que um set.
    while (setEndMs.length < state.setsHistory.length) setEndMs.push(t);
  }

  const startMs = startedAt
    ? new Date(startedAt).getTime()
    : new Date(active[0].created_at).getTime();

  // Durações dos sets terminados: cada fim menos o fim anterior (start no 1.º).
  const completed: number[] = [];
  let prevEnd = startMs;
  for (const endMs of setEndMs) {
    completed.push(Math.max(0, Math.round((endMs - prevEnd) / 1000)));
    prevEnd = endMs;
  }

  // Set em curso: do fim do último set terminado até agora (só se não acabou).
  const current = finishedAt
    ? null
    : Math.max(0, Math.round((serverNow - prevEnd) / 1000));

  return { completed, current };
}
