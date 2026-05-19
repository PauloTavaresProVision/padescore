"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { applyEvent } from "@/lib/scoring/engine";
import { useReconnect } from "@/lib/use-reconnect";
import type { MatchConfig, MatchState as EngineMatchState } from "@/lib/scoring/types";

export interface ScoreboardMatch {
  id: string;
  court_name: string;
  team_a_player1: string;
  team_a_player2: string | null;
  team_b_player1: string;
  team_b_player2: string | null;
  status: "scheduled" | "live" | "finished";
  started_at: string | null;
  finished_at: string | null;
}

export interface ScoreboardTournament {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
}

export interface ScoreboardState {
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
  winner: "A" | "B" | null;
}

const COL_SCORE = 70;     // largura normal de uma coluna de score
const COL_SCORE_LAST = 95; // largura da última coluna (mais espaço para o glow)
const COL_LOGO = 115;     // largura do logo box
const COL_MAIN = 620;     // largura da área principal
const ROW_HEADER = 36;
const ROW_TEAM = 64;
const ROW_FOOTER = 44;

const TOTAL_W = COL_LOGO + COL_MAIN;
const TOTAL_H = ROW_HEADER + ROW_TEAM * 2 + ROW_FOOTER;

export function Scoreboard({
  match: initialMatch,
  tournament,
  config,
  initialState,
}: {
  match: ScoreboardMatch;
  tournament: ScoreboardTournament;
  config: MatchConfig;
  initialState: ScoreboardState;
  variant?: "full" | "overlay";
}) {
  const [match, setMatch] = useState<ScoreboardMatch>(initialMatch);
  const [state, setState] = useState<ScoreboardState>(initialState);
  const [flashTeam, setFlashTeam] = useState<"A" | "B" | null>(null);

  // Ref para o estado actual (necessário porque o handler do realtime tem
  // closure sobre o initial state — sem isto, comparações ficavam sempre
  // contra o valor inicial e o flash caía sempre na primeira condição).
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Ref para o timeout actual de clear-flash (cancela o anterior se um novo
  // ponto chegar antes de 500ms — senão o flash do 2º ponto seria limpo cedo).
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Catch-up após queda de rede.
  const refetch = useCallback(async () => {
    const supabase = createClient();
    const [{ data: st }, { data: m }] = await Promise.all([
      supabase
        .from("match_state")
        .select("*")
        .eq("match_id", initialMatch.id)
        .single(),
      supabase
        .from("matches")
        .select(
          "court_name, team_a_player1, team_a_player2, team_b_player1, team_b_player2, status, started_at, finished_at",
        )
        .eq("id", initialMatch.id)
        .single(),
    ]);
    if (st) setState(st as unknown as ScoreboardState);
    if (m) {
      const row = m as Partial<ScoreboardMatch>;
      setMatch((prev) => ({
        ...prev,
        court_name: row.court_name ?? prev.court_name,
        team_a_player1: row.team_a_player1 ?? prev.team_a_player1,
        team_a_player2: row.team_a_player2 ?? null,
        team_b_player1: row.team_b_player1 ?? prev.team_b_player1,
        team_b_player2: row.team_b_player2 ?? null,
        status: row.status ?? prev.status,
        started_at: row.started_at ?? prev.started_at,
        finished_at: row.finished_at ?? prev.finished_at,
      }));
    }
  }, [initialMatch.id]);

  const { online, handleStatus } = useReconnect(refetch);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`match_state:${match.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "match_state",
          filter: `match_id=eq.${match.id}`,
        },
        (payload) => {
          const next = payload.new as unknown as ScoreboardState;
          const prev = stateRef.current;
          const aChanged =
            next.points_a !== prev.points_a ||
            next.games_a !== prev.games_a ||
            next.sets_a !== prev.sets_a;
          const bChanged =
            next.points_b !== prev.points_b ||
            next.games_b !== prev.games_b ||
            next.sets_b !== prev.sets_b;

          if (aChanged && !bChanged) setFlashTeam("A");
          else if (bChanged && !aChanged) setFlashTeam("B");

          setState(next);

          if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
          flashTimeoutRef.current = setTimeout(() => setFlashTeam(null), 600);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${match.id}`,
        },
        (payload) => {
          const m = payload.new as Partial<ScoreboardMatch>;
          setMatch((prev) => ({
            ...prev,
            court_name: m.court_name ?? prev.court_name,
            team_a_player1: m.team_a_player1 ?? prev.team_a_player1,
            team_a_player2: m.team_a_player2 ?? null,
            team_b_player1: m.team_b_player1 ?? prev.team_b_player1,
            team_b_player2: m.team_b_player2 ?? null,
            status: m.status ?? prev.status,
            started_at: m.started_at ?? prev.started_at,
            finished_at: m.finished_at ?? prev.finished_at,
          }));
        },
      )
      .subscribe(handleStatus);

    return () => {
      supabase.removeChannel(channel);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, [match.id]);

  const teamA = formatTeam(match.team_a_player1, match.team_a_player2);
  const teamB = formatTeam(match.team_b_player1, match.team_b_player2);
  const accent = tournament.primary_color ?? "#6faaff";
  const accentGlow = lighten(accent, 0.5);
  const isTiebreak = state.in_tiebreak || state.in_super_tiebreak;

  const hasProgress =
    state.points_a !== "0" ||
    state.points_b !== "0" ||
    state.games_a > 0 ||
    state.games_b > 0 ||
    state.sets_a > 0 ||
    state.sets_b > 0 ||
    state.sets_history.length > 0;
  const liveStatus: "scheduled" | "live" | "finished" = state.is_finished
    ? "finished"
    : hasProgress
      ? "live"
      : "scheduled";

  // Locked started_at: uma vez que tenhamos QUALQUER referência de início
  // (vinda da prop ou inferida ao detectar progresso), bloqueamos esse valor
  // e nunca mais o perdemos. Mesmo que o user faça undo até 0-0, o relógio
  // continua a correr.
  const [inferredStartedAt, setInferredStartedAt] = useState<string | null>(
    match.started_at,
  );
  useEffect(() => {
    if (inferredStartedAt) return; // já bloqueado — nunca volta a null
    if (match.started_at) {
      setInferredStartedAt(match.started_at);
      return;
    }
    if (hasProgress) {
      setInferredStartedAt(new Date().toISOString());
    }
  }, [hasProgress, inferredStartedAt, match.started_at]);

  const elapsed = useElapsedSeconds(inferredStartedAt, match.finished_at);

  const moment = useCriticalMoment(state, config);
  const completedSets = state.sets_history;
  const lastSetIdx = completedSets.length - 1;

  // Border styles
  const borderBright = `2px solid ${accentGlow}`;
  const borderDivider = "1px solid rgba(255, 255, 255, 0.08)";

  // Calcula as colunas de score que vão aparecer
  type ScoreCol =
    | { kind: "set"; index: number; value: number; opponentValue: number }
    | { kind: "games"; value: number }
    | { kind: "points"; value: string };

  const scoreColsA: ScoreCol[] = [
    ...completedSets.map((s, i) => ({
      kind: "set" as const,
      index: i,
      value: s.a,
      opponentValue: s.b,
    })),
    ...(state.is_finished
      ? []
      : ([
          { kind: "games" as const, value: state.games_a },
          { kind: "points" as const, value: state.points_a },
        ] as ScoreCol[])),
  ];

  const scoreColsB: ScoreCol[] = [
    ...completedSets.map((s, i) => ({
      kind: "set" as const,
      index: i,
      value: s.b,
      opponentValue: s.a,
    })),
    ...(state.is_finished
      ? []
      : ([
          { kind: "games" as const, value: state.games_b },
          { kind: "points" as const, value: state.points_b },
        ] as ScoreCol[])),
  ];

  const lastColIdx = scoreColsA.length - 1;

  return (
    <div
      className="inline-flex select-none flex-col gap-1.5"
      style={{ fontFamily: "var(--font-inter), Inter, system-ui, sans-serif" }}
    >
      <style>{`
        @keyframes scoreboard-pulse {
          0%, 100% {
            opacity: 0.6;
            filter: drop-shadow(0 0 3px rgba(255,255,255,0.5));
          }
          50% {
            opacity: 1;
            filter: drop-shadow(0 0 10px rgba(255,255,255,1)) drop-shadow(0 0 20px rgba(255,255,255,0.6));
          }
        }
      `}</style>

      <div
        className="grid text-white"
        style={{
          position: "relative",
          gridTemplateColumns: `${COL_LOGO}px ${COL_MAIN}px`,
          gridTemplateRows: `${ROW_HEADER}px ${ROW_TEAM}px ${ROW_TEAM}px ${ROW_FOOTER}px`,
          filter: `drop-shadow(0 0 10px ${accentGlow}80) drop-shadow(0 0 30px ${accentGlow}33)`,
        }}
      >
        {!online && (
          <span
            title="Sem ligação — a reconectar"
            style={{
              position: "absolute",
              top: 4,
              right: 6,
              zIndex: 20,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#ff5d5d",
              boxShadow: "0 0 6px #ff5d5d",
            }}
          />
        )}
        {/* HEADER — linha 1, col 2 (sai por cima do logo) */}
        <div
          className="flex items-center"
          style={{
            position: "relative",
            gridColumn: "2 / 3",
            gridRow: "1 / 2",
            background: "linear-gradient(180deg, #2b313d 0%, #1c2029 100%)",
            borderRadius: "12px 12px 0 0",
            borderTop: borderBright,
            borderLeft: borderBright,
            borderRight: borderBright,
            borderBottom: borderDivider,
            overflow: "hidden",
          }}
        >
          <div
            className="truncate"
            style={{
              flex: 1,
              paddingLeft: 20,
              fontSize: 11,
              fontWeight: 700,
              color: "#768091",
              letterSpacing: "0.5px",
              textTransform: "uppercase",
            }}
          >
            {tournament.name}
          </div>
          {scoreColsA.map((col, i) => {
            const isLast = i === lastColIdx;
            const w = isLast ? COL_SCORE_LAST : COL_SCORE;
            let label = "";
            if (col.kind === "set") {
              const s = completedSets[col.index];
              label = `Set ${col.index + 1}${isTiebreakSet(s) ? " (TB)" : ""}`;
            } else if (col.kind === "games") {
              label = "Games";
            } else if (col.kind === "points") {
              label = "Pts";
            }
            return (
              <div
                key={i}
                className="flex h-full items-center justify-center"
                style={{
                  width: w,
                  borderLeft: borderDivider,
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#768091",
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                }}
              >
                {label}
              </div>
            );
          })}
        </div>

        {/* LOGO BOX — linhas 2-4, col 1 (mais curta que a main) */}
        <div
          className="flex items-center justify-center"
          style={{
            gridColumn: "1 / 2",
            gridRow: "2 / 5",
            background: `radial-gradient(ellipse at center, ${accent}1f 0%, transparent 55%), linear-gradient(180deg, #1d2330 0%, #0a0d12 100%)`,
            borderRadius: "12px 0 0 12px",
            borderTop: borderBright,
            borderLeft: borderBright,
            borderBottom: borderBright,
            borderRight: borderDivider,
            boxShadow:
              "inset 0 0 35px rgba(0,0,0,0.55), inset 0 2px 0 rgba(255,255,255,0.04)",
          }}
        >
          {tournament.logo_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={tournament.logo_url}
              alt=""
              style={{
                width: 75,
                height: 75,
                objectFit: "contain",
                filter: `drop-shadow(0 0 8px ${accentGlow}cc)`,
              }}
            />
          ) : (
            <div
              className="flex items-center justify-center"
              style={{
                width: 75,
                height: 75,
                background: accent,
                borderRadius: 12,
                fontSize: 32,
                fontWeight: 900,
                color: "#fff",
                filter: `drop-shadow(0 0 8px ${accentGlow}cc)`,
              }}
            >
              {tournament.name.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        {/* TEAM 1 — linha 2, col 2 */}
        <TeamRow
          gridRow="2 / 3"
          name={teamA}
          serving={state.server === "A" && !state.is_finished}
          scoreCols={scoreColsA}
          lastColIdx={lastColIdx}
          isTiebreak={isTiebreak}
          isMatchOver={state.is_finished}
          winner={state.is_finished && state.winner === "A"}
          flash={flashTeam === "A"}
          lastSetIdx={lastSetIdx}
          borderDivider={borderDivider}
          borderBright={borderBright}
          isBottomRow={false}
          accentGlow={accentGlow}
        />

        {/* TEAM 2 — linha 3, col 2 */}
        <TeamRow
          gridRow="3 / 4"
          name={teamB}
          serving={state.server === "B" && !state.is_finished}
          scoreCols={scoreColsB}
          lastColIdx={lastColIdx}
          isTiebreak={isTiebreak}
          isMatchOver={state.is_finished}
          winner={state.is_finished && state.winner === "B"}
          flash={flashTeam === "B"}
          lastSetIdx={lastSetIdx}
          borderDivider={borderDivider}
          borderBright={borderBright}
          isBottomRow={true}
          accentGlow={accentGlow}
        />

        {/* FOOTER — linha 4, col 2 */}
        <div
          className="flex items-center"
          style={{
            gridColumn: "2 / 3",
            gridRow: "4 / 5",
            background: "#090b0e",
            borderRadius: "0 0 12px 0",
            borderRight: borderBright,
            borderBottom: borderBright,
            padding: "0 20px",
            gap: 12,
          }}
        >
          {liveStatus === "finished" ? (
            <div
              className="flex items-center"
              style={{
                color: "#c4f600",
                fontSize: 14,
                fontWeight: 900,
                gap: 6,
                letterSpacing: "0.5px",
              }}
            >
              TERMINADO
              <span
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 18,
                  height: 18,
                  background: "#c4f600",
                  color: "#000",
                }}
              >
                <CheckIcon className="h-3 w-3" />
              </span>
            </div>
          ) : liveStatus === "live" ? (
            <div
              className="flex items-center"
              style={{
                color: "#c4f600",
                fontSize: 14,
                fontWeight: 900,
                gap: 8,
                letterSpacing: "0.5px",
              }}
            >
              <span className="relative inline-block h-2 w-2">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
                <span className="absolute inset-0 rounded-full bg-emerald-400" />
              </span>
              LIVE
            </div>
          ) : (
            <span
              style={{
                color: "#768091",
                fontSize: 14,
                fontWeight: 900,
                letterSpacing: "0.5px",
              }}
            >
              AGENDADO
            </span>
          )}

          {/* Moment label (golden point, match point, tiebreak...) centrado */}
          <div className="flex flex-1 items-center justify-center">
            {moment && <InlineMoment moment={moment} />}
          </div>

          {elapsed !== null && (
            <div
              className="flex items-center tabular-nums"
              style={{
                color: "#768091",
                fontSize: 15,
                fontWeight: 800,
                gap: 6,
              }}
            >
              <ClockIcon className="h-[15px] w-[15px]" />
              {formatElapsed(elapsed)}
            </div>
          )}
        </div>

        {/* Shimmer SVG: comet percorrendo todo o contorno em L */}
        <svg
          width={TOTAL_W}
          height={TOTAL_H}
          viewBox={`0 0 ${TOTAL_W} ${TOTAL_H}`}
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            overflow: "visible",
          }}
        >
          <path
            d={(() => {
              const r = 12; // raio dos cantos exteriores (igual ao border-radius)
              return [
                // Começa no fim do arco superior-esquerdo do header (no eixo Y, a r px do topo)
                `M ${COL_LOGO},${r}`,
                // Arco superior-esquerdo do header (curva para o topo)
                `A ${r},${r} 0 0 1 ${COL_LOGO + r},0`,
                // Top do header até antes do canto superior-direito
                `L ${TOTAL_W - r},0`,
                // Arco superior-direito
                `A ${r},${r} 0 0 1 ${TOTAL_W},${r}`,
                // Lateral direita
                `L ${TOTAL_W},${TOTAL_H - r}`,
                // Arco inferior-direito
                `A ${r},${r} 0 0 1 ${TOTAL_W - r},${TOTAL_H}`,
                // Bottom até antes do canto inferior-esquerdo
                `L ${r},${TOTAL_H}`,
                // Arco inferior-esquerdo
                `A ${r},${r} 0 0 1 0,${TOTAL_H - r}`,
                // Lateral esquerda do logo box subindo
                `L 0,${ROW_HEADER + r}`,
                // Arco superior-esquerdo do logo
                `A ${r},${r} 0 0 1 ${r},${ROW_HEADER}`,
                // Topo do logo box até ao canto interior côncavo
                `L ${COL_LOGO},${ROW_HEADER}`,
                // Fecha: linha vertical do canto interior côncavo subindo até ao M inicial
                `Z`,
              ].join(" ");
            })()}
            fill="none"
            stroke="#ffffff"
            strokeWidth={2}
            strokeLinejoin="round"
            style={{
              animation: "scoreboard-pulse 2.2s ease-in-out infinite",
            }}
          />
        </svg>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Team row
// ---------------------------------------------------------------------------
function TeamRow({
  gridRow,
  name,
  serving,
  scoreCols,
  lastColIdx,
  isTiebreak,
  isMatchOver,
  winner,
  flash,
  lastSetIdx,
  borderDivider,
  borderBright,
  isBottomRow,
  accentGlow,
}: {
  gridRow: string;
  name: string;
  serving: boolean;
  scoreCols: Array<
    | { kind: "set"; index: number; value: number; opponentValue: number }
    | { kind: "games"; value: number }
    | { kind: "points"; value: string }
  >;
  lastColIdx: number;
  isTiebreak: boolean;
  isMatchOver: boolean;
  winner: boolean;
  flash: boolean;
  lastSetIdx: number;
  borderDivider: string;
  borderBright: string;
  isBottomRow: boolean;
  accentGlow: string;
}) {
  return (
    <div
      className="flex"
      style={{
        position: "relative",
        gridColumn: "2 / 3",
        gridRow,
        background: "linear-gradient(180deg, #1c2029 0%, #12151b 100%)",
        borderRight: borderBright,
        borderBottom: isBottomRow
          ? "2px solid rgba(0,0,0,0.6)"
          : borderDivider,
        overflow: "hidden",
      }}
    >
      {/* Nome + server indicator + badge */}
      <div
        className="flex h-full items-center"
        style={{ flex: 1, paddingLeft: 20, gap: 10 }}
      >
        {serving ? (
          <span className="relative inline-block h-2.5 w-2.5 shrink-0">
            <span className="absolute inset-0 animate-ping rounded-full bg-yellow-400/70" />
            <span className="absolute inset-0 rounded-full bg-yellow-400" />
          </span>
        ) : (
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: "rgba(255,255,255,0.1)" }}
          />
        )}
        <span
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "-0.5px",
            textTransform: "uppercase",
          }}
        >
          {name}
        </span>
        {winner && (
          <span
            style={{
              background: "linear-gradient(90deg, #c4f600, #a0d100)",
              color: "#000",
              fontSize: 11,
              fontWeight: 900,
              padding: "5px 9px",
              borderRadius: 5,
              marginLeft: 14,
              letterSpacing: "0.5px",
              boxShadow: "0 0 15px rgba(196,246,0,0.35)",
            }}
          >
            VENCEDOR
          </span>
        )}
      </div>

      {/* Score columns */}
      {scoreCols.map((col, i) => {
        const isLast = i === lastColIdx;
        const w = isLast ? COL_SCORE_LAST : COL_SCORE;

        let value: string | number = "";
        let scoreState: "dim" | "active" | "glow" | "tiebreak" = "dim";
        let fontSize = 30;

        if (col.kind === "set") {
          value = col.value;
          const won = col.value > col.opponentValue;
          if (isMatchOver && col.index === lastSetIdx && won) {
            scoreState = "glow";
            fontSize = 34;
          } else if (won) {
            scoreState = "active";
          } else {
            scoreState = "dim";
          }
        } else if (col.kind === "games") {
          value = col.value;
          scoreState = "active";
        } else if (col.kind === "points") {
          value = col.value;
          scoreState = isTiebreak ? "tiebreak" : "active";
        }

        const styleColor: React.CSSProperties = {};
        if (scoreState === "dim") {
          styleColor.color = "#3b4252";
        } else if (scoreState === "active") {
          styleColor.color = "#ffffff";
          styleColor.textShadow = "0 0 12px rgba(255,255,255,0.4)";
        } else if (scoreState === "glow") {
          styleColor.color = "#ffffff";
          styleColor.textShadow = `0 0 10px #ffffff, 0 0 25px ${accentGlow}, 0 0 50px ${accentGlow}`;
        } else if (scoreState === "tiebreak") {
          styleColor.color = "#fbbf24";
          styleColor.textShadow = "0 0 12px rgba(251,191,36,0.6)";
        }

        if (flash && col.kind === "points") {
          styleColor.color = "#c4f600";
        }

        return (
          <div
            key={i}
            className="flex h-full items-center justify-center tabular-nums"
            style={{
              width: w,
              borderLeft: borderDivider,
              fontSize,
              fontWeight: 800,
              ...styleColor,
            }}
          >
            {value}
          </div>
        );
      })}
    </div>
  );
}


// ---------------------------------------------------------------------------
// Critical moment
// ---------------------------------------------------------------------------
type MomentColor = "red" | "orange" | "yellow" | "amber";

interface Moment {
  label: string;
  color: MomentColor;
  team: "A" | "B" | "both";
}

function useCriticalMoment(
  state: ScoreboardState,
  config: MatchConfig,
): Moment | null {
  if (state.is_finished) return null;

  const engineState: EngineMatchState = {
    pointsA: state.points_a,
    pointsB: state.points_b,
    gamesA: state.games_a,
    gamesB: state.games_b,
    setsA: state.sets_a,
    setsB: state.sets_b,
    setsHistory: state.sets_history,
    server: state.server,
    inTiebreak: state.in_tiebreak,
    inSuperTiebreak: state.in_super_tiebreak,
    isFinished: state.is_finished,
    winner: state.winner,
  };

  const afterA = applyEvent(engineState, { type: "point", team: "A" }, config);
  const afterB = applyEvent(engineState, { type: "point", team: "B" }, config);
  const setsBefore = engineState.setsA + engineState.setsB;

  const matchPointA = afterA.isFinished && afterA.winner === "A";
  const matchPointB = afterB.isFinished && afterB.winner === "B";
  if (matchPointA && matchPointB) return { label: "Match Point", color: "red", team: "both" };
  if (matchPointA) return { label: "Match Point", color: "red", team: "A" };
  if (matchPointB) return { label: "Match Point", color: "red", team: "B" };

  const setPointA = afterA.setsA + afterA.setsB > setsBefore;
  const setPointB = afterB.setsA + afterB.setsB > setsBefore;
  if (setPointA && setPointB) return { label: "Set Point", color: "orange", team: "both" };
  if (setPointA) return { label: "Set Point", color: "orange", team: "A" };
  if (setPointB) return { label: "Set Point", color: "orange", team: "B" };

  if (
    config.goldenPoint &&
    !engineState.inTiebreak &&
    !engineState.inSuperTiebreak &&
    engineState.pointsA === "40" &&
    engineState.pointsB === "40"
  ) {
    return { label: "Golden Point", color: "yellow", team: "both" };
  }

  if (engineState.inSuperTiebreak) return { label: "Super Tiebreak", color: "amber", team: "both" };
  if (engineState.inTiebreak) return { label: "Tiebreak", color: "amber", team: "both" };

  return null;
}

function InlineMoment({ moment }: { moment: Moment }) {
  const colors: Record<MomentColor, { bg: string; fg: string }> = {
    red: { bg: "rgba(239,68,68,0.2)", fg: "#fca5a5" },
    orange: { bg: "rgba(249,115,22,0.2)", fg: "#fdba74" },
    yellow: { bg: "rgba(234,179,8,0.22)", fg: "#fde68a" },
    amber: { bg: "rgba(245,158,11,0.2)", fg: "#fcd34d" },
  };
  const c = colors[moment.color];
  return (
    <div
      className="flex items-center"
      style={{
        gap: 6,
        background: c.bg,
        color: c.fg,
        borderRadius: 999,
        padding: "3px 10px",
        fontSize: 11,
        fontWeight: 900,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
      }}
    >
      {moment.team !== "both" && (
        <span style={{ opacity: 0.7 }}>{moment.team}</span>
      )}
      <span className="animate-pulse">{moment.label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function isTiebreakSet(s: { a: number; b: number }): boolean {
  const max = Math.max(s.a, s.b);
  const min = Math.min(s.a, s.b);
  if (max >= 10) return true;
  return max === 7 && min === 6;
}

function lighten(hex: string, percent: number): string {
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  const lift = (c: number) => Math.min(255, Math.floor(c + (255 - c) * percent));
  r = lift(r);
  g = lift(g);
  b = lift(b);
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function formatTeam(p1: string, p2: string | null): string {
  if (!p2) return `${p1}`.toUpperCase();
  return `${p1} / ${p2}`.toUpperCase();
}

function useElapsedSeconds(
  startedAt: string | null,
  finishedAt: string | null,
): number | null {
  // null inicial garante que SSR e cliente renderizam o mesmo (nada).
  // Só a partir do useEffect (client-only) é que o timer arranca.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!startedAt) return;
    if (finishedAt) {
      setNow(new Date(finishedAt).getTime());
      return;
    }
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt, finishedAt]);

  if (!startedAt || now === null) return null;
  const end = finishedAt ? new Date(finishedAt).getTime() : now;
  return Math.max(0, Math.floor((end - new Date(startedAt).getTime()) / 1000));
}

function formatElapsed(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${pad(m)}:${pad(sec)}`;
}
