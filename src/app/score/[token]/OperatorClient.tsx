"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { applyEvent } from "@/lib/scoring/engine";
import { useReconnect } from "@/lib/use-reconnect";
import type { MatchConfig, MatchState as EngineState } from "@/lib/scoring/types";
import { UndoIcon } from "@/components/icons";

interface DbState {
  points_a: string;
  points_b: string;
  games_a: number;
  games_b: number;
  sets_a: number;
  sets_b: number;
  sets_history: { a: number; b: number }[];
  server: "A" | "B";
  in_tiebreak: boolean;
  in_super_tiebreak: boolean;
  is_finished: boolean;
}

function dbToEngine(s: DbState): EngineState {
  return {
    pointsA: s.points_a,
    pointsB: s.points_b,
    gamesA: s.games_a,
    gamesB: s.games_b,
    setsA: s.sets_a,
    setsB: s.sets_b,
    setsHistory: s.sets_history ?? [],
    server: s.server,
    inTiebreak: s.in_tiebreak,
    inSuperTiebreak: s.in_super_tiebreak,
    isFinished: s.is_finished,
    winner: null,
  };
}

function engineToDb(s: EngineState): DbState {
  return {
    points_a: s.pointsA,
    points_b: s.pointsB,
    games_a: s.gamesA,
    games_b: s.gamesB,
    sets_a: s.setsA,
    sets_b: s.setsB,
    sets_history: s.setsHistory,
    server: s.server,
    in_tiebreak: s.inTiebreak,
    in_super_tiebreak: s.inSuperTiebreak,
    is_finished: s.isFinished,
  };
}

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // ignore
  }
}

// Sequência de pontos do padel (fora de tiebreak).
const POINT_SEQ = ["0", "15", "30", "40", "AD"] as const;

function prevPoint(points: string, tiebreak: boolean): string | null {
  if (tiebreak) {
    const n = parseInt(points, 10);
    return Number.isNaN(n) || n <= 0 ? null : String(n - 1);
  }
  const i = POINT_SEQ.indexOf(points as (typeof POINT_SEQ)[number]);
  return i <= 0 ? null : POINT_SEQ[i - 1];
}

function nextPoint(points: string, tiebreak: boolean): string | null {
  if (tiebreak) {
    const n = parseInt(points, 10);
    return String((Number.isNaN(n) ? 0 : n) + 1);
  }
  const i = POINT_SEQ.indexOf(points as (typeof POINT_SEQ)[number]);
  if (i < 0) return "0";
  return i >= POINT_SEQ.length - 1 ? null : POINT_SEQ[i + 1];
}

export function OperatorClient({
  token,
  matchId,
  teamA,
  teamB,
  court,
  config,
  initialState,
}: {
  token: string;
  matchId: string;
  teamA: string;
  teamB: string;
  court: string;
  config: MatchConfig;
  initialState: DbState;
}) {
  const [state, setState] = useState<DbState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [inFlight, setInFlight] = useState(0);
  const [flash, setFlash] = useState<"A" | "B" | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const inFlightRef = useRef(0);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  // Catch-up após queda de rede — não sobrescreve se houver pedidos em voo.
  const refetch = useCallback(async () => {
    if (inFlightRef.current > 0) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("match_state")
      .select("*")
      .eq("match_id", matchId)
      .single();
    if (data && inFlightRef.current === 0) {
      setState(data as unknown as DbState);
    }
  }, [matchId]);

  const { online, handleStatus } = useReconnect(refetch);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`op:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "match_state",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          if (inFlightRef.current > 0) return;
          setState(payload.new as unknown as DbState);
        },
      )
      .subscribe(handleStatus);
    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, handleStatus]);

  function send(body: object, optimistic: () => DbState) {
    setState(optimistic());
    setError(null);
    inFlightRef.current += 1;
    setInFlight(inFlightRef.current);

    queueRef.current = queueRef.current
      .then(() =>
        fetch(`/api/score/${token}/event`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      )
      .then(async (res) => {
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          setError(json.error ?? "Falha no envio");
          return;
        }
        const json = await res.json();
        if (inFlightRef.current === 1 && json.state) {
          setState(engineToDb(json.state));
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Sem ligação"))
      .finally(() => {
        inFlightRef.current -= 1;
        setInFlight(inFlightRef.current);
      });
  }

  function addPoint(team: "A" | "B") {
    if (state.is_finished) return;
    vibrate(12);
    setFlash(team);
    setTimeout(() => setFlash(null), 220);
    send({ type: "point", team }, () => {
      const next = applyEvent(dbToEngine(state), { type: "point", team }, config);
      return engineToDb(next);
    });
  }

  function undoPoint() {
    vibrate([8, 25, 8]);
    send({ type: "undo" }, () => state);
  }

  const isTb = state.in_tiebreak || state.in_super_tiebreak;

  function quickMinus(team: "A" | "B") {
    if (state.is_finished) return;
    const cur = team === "A" ? state.points_a : state.points_b;
    const prev = prevPoint(cur, isTb);
    if (prev === null) {
      setError(
        'Ponto desta dupla já está a 0. Usa "Corrigir resultado" para mexer em games.',
      );
      return;
    }
    setError(null);
    vibrate([8, 25, 8]);
    const key = team === "A" ? "pointsA" : "pointsB";
    send({ type: "manual", payload: { [key]: prev } }, () => ({
      ...state,
      ...(team === "A" ? { points_a: prev } : { points_b: prev }),
    }));
  }

  function applyCorrection(d: {
    pa: string;
    pb: string;
    ga: number;
    gb: number;
  }) {
    setError(null);
    vibrate([10, 30, 10]);
    send(
      {
        type: "manual",
        payload: {
          pointsA: d.pa,
          pointsB: d.pb,
          gamesA: d.ga,
          gamesB: d.gb,
        },
      },
      () => ({
        ...state,
        points_a: d.pa,
        points_b: d.pb,
        games_a: d.ga,
        games_b: d.gb,
      }),
    );
    setPanelOpen(false);
  }

  function swapServer() {
    vibrate(6);
    send({ type: "swap_server" }, () => ({
      ...state,
      server: state.server === "A" ? "B" : "A",
    }));
  }

  const sending = inFlight > 0;

  return (
    <div
      className="fixed inset-0 grid grid-rows-[auto_1fr_1fr_auto] gap-2 overflow-hidden bg-slate-950 p-2 text-white"
      style={{ touchAction: "manipulation" }}
    >
      {/* HEADER */}
      <header className="flex items-center justify-between gap-2 px-2 pt-1">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
          <span>{court}</span>
          {isTb && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-300">
              {state.in_super_tiebreak ? "Super Tiebreak" : "Tiebreak"}
            </span>
          )}
          {state.is_finished && (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300">
              Terminado
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={swapServer}
            disabled={state.is_finished}
            className="rounded-full border border-slate-700/80 bg-slate-900/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-200 transition active:scale-95 disabled:opacity-30"
          >
            <span className="opacity-60">Serve</span> {state.server}{" "}
            <span className="opacity-60">⇆</span>
          </button>
          <StatusDot
            sending={sending}
            error={!!error}
            inFlight={inFlight}
            online={online}
          />
        </div>
      </header>

      {error && (
        <div className="mx-1 -my-1 rounded-md border border-red-500/30 bg-red-500/15 px-3 py-1.5 text-center text-[11px] text-red-200">
          {error}
        </div>
      )}

      {/* TEAM CARDS */}
      <TeamCard
        team="A"
        name={teamA}
        sets={state.sets_history.map((h) => h.a)}
        games={state.games_a}
        points={state.points_a}
        serving={state.server === "A" && !state.is_finished}
        flashing={flash === "A"}
        finished={state.is_finished}
        canMinus={prevPoint(state.points_a, isTb) !== null}
        onTap={() => addPoint("A")}
        onMinus={() => quickMinus("A")}
      />

      <TeamCard
        team="B"
        name={teamB}
        sets={state.sets_history.map((h) => h.b)}
        games={state.games_b}
        points={state.points_b}
        serving={state.server === "B" && !state.is_finished}
        flashing={flash === "B"}
        finished={state.is_finished}
        canMinus={prevPoint(state.points_b, isTb) !== null}
        onTap={() => addPoint("B")}
        onMinus={() => quickMinus("B")}
      />

      {/* FOOTER */}
      <footer className="grid grid-cols-2 gap-2 px-1 pb-1">
        <UndoChip onClick={undoPoint} label="Anular" />
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          disabled={state.is_finished}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-cyan-500/25 bg-cyan-500/[0.06] py-3 text-cyan-300/90 transition active:scale-95 active:bg-cyan-500/15 active:text-cyan-200 disabled:opacity-30"
        >
          <span className="text-base leading-none">✎</span>
          <span className="text-[11px] font-bold uppercase tracking-widest">
            Corrigir resultado
          </span>
        </button>
      </footer>

      {panelOpen && (
        <CorrectionPanel
          state={state}
          isTiebreak={isTb}
          teamA={teamA}
          teamB={teamB}
          onCancel={() => setPanelOpen(false)}
          onApply={applyCorrection}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Team card — o foco da experiência. Card distinto, score gigante, hint de tap.
// ---------------------------------------------------------------------------
function TeamCard({
  team,
  name,
  sets,
  games,
  points,
  serving,
  flashing,
  finished,
  canMinus,
  onTap,
  onMinus,
}: {
  team: "A" | "B";
  name: string;
  sets: number[];
  games: number;
  points: string;
  serving: boolean;
  flashing: boolean;
  finished: boolean;
  canMinus: boolean;
  onTap: () => void;
  onMinus: () => void;
}) {
  const isA = team === "A";
  const accentHex = isA ? "#10b981" : "#06b6d4";

  return (
    <div
      role="button"
      tabIndex={finished ? -1 : 0}
      aria-disabled={finished}
      onClick={finished ? undefined : onTap}
      onKeyDown={(e) => {
        if (!finished && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onTap();
        }
      }}
      className={[
        "group relative flex flex-col overflow-hidden rounded-2xl text-left transition-all duration-150 select-none",
        "border-2",
        isA ? "border-emerald-500/20" : "border-cyan-500/20",
        finished ? "cursor-not-allowed opacity-50" : "cursor-pointer active:scale-[0.99]",
        flashing
          ? isA
            ? "border-emerald-400/80"
            : "border-cyan-400/80"
          : "",
      ].join(" ")}
      style={{
        background: flashing
          ? `radial-gradient(ellipse at center, ${accentHex}40 0%, ${accentHex}15 40%, rgba(2,6,23,1) 100%)`
          : `radial-gradient(ellipse at center, ${accentHex}1a 0%, ${accentHex}08 40%, rgba(2,6,23,1) 100%)`,
      }}
    >
      {/* HEADER do card — nome + serve + −1 */}
      <div className="flex items-center gap-2.5 px-4 py-3">
        <span
          className={[
            "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-black",
            isA
              ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
              : "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30",
          ].join(" ")}
        >
          {team}
        </span>
        <span className="flex-1 truncate text-[15px] font-bold uppercase tracking-wide text-white">
          {name}
        </span>
        {serving && (
          <span
            className={[
              "flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest",
              isA ? "bg-emerald-500/15 text-emerald-300" : "bg-cyan-500/15 text-cyan-300",
            ].join(" ")}
          >
            <span className="relative inline-block h-1.5 w-1.5">
              <span className={`absolute inset-0 animate-ping rounded-full ${isA ? "bg-emerald-400/60" : "bg-cyan-400/60"}`} />
              <span className={`absolute inset-0 rounded-full ${isA ? "bg-emerald-400" : "bg-cyan-400"}`} />
            </span>
            Serve
          </span>
        )}
        {/* −1 ponto a esta dupla. stopPropagation para não somar ponto. */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMinus();
          }}
          disabled={finished || !canMinus}
          aria-label={`Tirar um ponto à dupla ${team}`}
          title="Tirar 1 ponto a esta dupla"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-2xl font-black leading-none text-amber-300 transition active:scale-90 disabled:opacity-20"
        >
          −
        </button>
      </div>

      {/* SCORE — gigante e dominante */}
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="flex items-end gap-3">
          {/* Sets passados, pequenos do lado */}
          {sets.length > 0 && (
            <div className="flex flex-col items-center pb-3">
              <div className="flex items-baseline gap-1.5 text-xl font-bold tabular-nums text-slate-500">
                {sets.map((s, i) => (
                  <span key={i}>{s}</span>
                ))}
              </div>
              <div className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.25em] text-slate-700">
                sets
              </div>
            </div>
          )}

          {/* Games — médio */}
          <div className="flex flex-col items-center pb-3">
            <span className="text-[56px] font-black leading-none tabular-nums text-slate-300">
              {games}
            </span>
            <span className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.25em] text-slate-500">
              games
            </span>
          </div>

          {/* Pontos — DOMINANTE, sem competição */}
          <div className="flex flex-col items-center">
            <span
              className={[
                "font-black leading-none tabular-nums tracking-tight",
                "text-[110px]",
                isA ? "text-emerald-300" : "text-cyan-300",
              ].join(" ")}
              style={{
                textShadow: `0 0 60px ${accentHex}40`,
              }}
            >
              {points}
            </span>
            <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.25em] text-slate-500">
              pontos
            </span>
          </div>
        </div>
      </div>

      {/* Hint de tap, subtil, na base */}
      <div
        className={[
          "flex items-center justify-center gap-2 px-4 py-2 text-[9px] font-bold uppercase tracking-[0.3em]",
          isA ? "text-emerald-400/40" : "text-cyan-400/40",
          "group-active:text-white/80",
        ].join(" ")}
      >
        <span className="h-px w-6 bg-current opacity-60" />
        toca para somar +1
        <span className="h-px w-6 bg-current opacity-60" />
      </div>
    </div>
  );
}

function StatusDot({
  sending,
  error,
  inFlight,
  online,
}: {
  sending: boolean;
  error: boolean;
  inFlight: number;
  online: boolean;
}) {
  if (!online) {
    return (
      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-red-400">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-400" />
        offline
      </span>
    );
  }
  if (error) {
    return (
      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-red-400">
        <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
        erro
      </span>
    );
  }
  if (sending) {
    return (
      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-cyan-400 tabular-nums">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
        {inFlight}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
      <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
      live
    </span>
  );
}

function UndoChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] py-3 text-amber-300/80 transition active:scale-95 active:bg-amber-500/15 active:text-amber-200"
    >
      <UndoIcon className="h-4 w-4" />
      <span className="text-[11px] font-bold uppercase tracking-widest">{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Painel "Corrigir resultado" — define directamente Pontos/Games por dupla.
// Para o caso "descoberto tarde": pões o resultado verdadeiro AGORA, sem
// desfazer o histórico (evento `manual` no motor).
// ---------------------------------------------------------------------------
function CorrectionPanel({
  state,
  isTiebreak,
  teamA,
  teamB,
  onCancel,
  onApply,
}: {
  state: DbState;
  isTiebreak: boolean;
  teamA: string;
  teamB: string;
  onCancel: () => void;
  onApply: (d: { pa: string; pb: string; ga: number; gb: number }) => void;
}) {
  const [pa, setPa] = useState(state.points_a);
  const [pb, setPb] = useState(state.points_b);
  const [ga, setGa] = useState(state.games_a);
  const [gb, setGb] = useState(state.games_b);

  const changed =
    pa !== state.points_a ||
    pb !== state.points_b ||
    ga !== state.games_a ||
    gb !== state.games_b;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-3 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest text-white">
            Corrigir resultado
          </h2>
          {isTiebreak && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-300">
              Tiebreak
            </span>
          )}
        </div>
        <p className="mb-4 text-[11px] leading-snug text-slate-500">
          Põe o resultado verdadeiro do <strong className="text-slate-300">set
          actual</strong>. Não mexe nos sets já concluídos nem no serviço.
        </p>

        <div className="space-y-3">
          <CorrectRow
            label={teamA}
            accent="emerald"
            points={pa}
            games={ga}
            isTiebreak={isTiebreak}
            onPoints={setPa}
            onGames={setGa}
          />
          <CorrectRow
            label={teamB}
            accent="cyan"
            points={pb}
            games={gb}
            isTiebreak={isTiebreak}
            onPoints={setPb}
            onGames={setGb}
          />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-700 py-3 text-sm font-bold uppercase tracking-widest text-slate-300 transition active:scale-95"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!changed}
            onClick={() => onApply({ pa, pb, ga, gb })}
            className="rounded-xl bg-emerald-500 py-3 text-sm font-bold uppercase tracking-widest text-slate-950 transition active:scale-95 disabled:opacity-30"
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}

function CorrectRow({
  label,
  accent,
  points,
  games,
  isTiebreak,
  onPoints,
  onGames,
}: {
  label: string;
  accent: "emerald" | "cyan";
  points: string;
  games: number;
  isTiebreak: boolean;
  onPoints: (v: string) => void;
  onGames: (v: number) => void;
}) {
  const ring =
    accent === "emerald"
      ? "ring-emerald-500/30 text-emerald-300"
      : "ring-cyan-500/30 text-cyan-300";

  const canPointDown = prevPoint(points, isTiebreak) !== null;
  const canPointUp = nextPoint(points, isTiebreak) !== null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
      <div className={`mb-2 truncate text-xs font-bold uppercase tracking-wide ${ring.split(" ")[1]}`}>
        {label}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Stepper
          caption="Pontos"
          value={points}
          canDown={canPointDown}
          canUp={canPointUp}
          onDown={() => {
            const p = prevPoint(points, isTiebreak);
            if (p !== null) onPoints(p);
          }}
          onUp={() => {
            const p = nextPoint(points, isTiebreak);
            if (p !== null) onPoints(p);
          }}
        />
        <Stepper
          caption="Games"
          value={String(games)}
          canDown={games > 0}
          canUp={games < 99}
          onDown={() => onGames(Math.max(0, games - 1))}
          onUp={() => onGames(games + 1)}
        />
      </div>
    </div>
  );
}

function Stepper({
  caption,
  value,
  canDown,
  canUp,
  onDown,
  onUp,
}: {
  caption: string;
  value: string;
  canDown: boolean;
  canUp: boolean;
  onDown: () => void;
  onUp: () => void;
}) {
  return (
    <div>
      <div className="mb-1 text-center text-[9px] font-bold uppercase tracking-[0.25em] text-slate-500">
        {caption}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onDown}
          disabled={!canDown}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-slate-700 bg-slate-900 text-2xl font-black leading-none text-slate-200 transition active:scale-90 disabled:opacity-20"
        >
          −
        </button>
        <div className="flex-1 rounded-lg bg-slate-800/60 py-2 text-center text-2xl font-black tabular-nums text-white">
          {value}
        </div>
        <button
          type="button"
          onClick={onUp}
          disabled={!canUp}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-slate-700 bg-slate-900 text-2xl font-black leading-none text-slate-200 transition active:scale-90 disabled:opacity-20"
        >
          +
        </button>
      </div>
    </div>
  );
}
