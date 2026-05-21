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

// Valores BASE em pixels (scale=1). Para renderizar maior nativamente (sem
// CSS scale/zoom que falham em capture devices), o componente aceita um
// prop `scale` que multiplica TODOS os pixels — assim os elementos saem em
// pixels reais maiores, em vez de pixels pequenos esticados.
const BASE_COL_SCORE = 70;
const BASE_COL_SCORE_LAST = 95;
const BASE_COL_LOGO = 115;
const BASE_COL_MAIN = 620;
const BASE_ROW_HEADER = 36;
const BASE_ROW_TEAM = 64;
const BASE_ROW_FOOTER = 44;
const BASE_TOTAL_W = BASE_COL_LOGO + BASE_COL_MAIN; // 735
const BASE_TOTAL_H = BASE_ROW_HEADER + BASE_ROW_TEAM * 2 + BASE_ROW_FOOTER; // 208

export const SCOREBOARD_BASE_W = BASE_TOTAL_W;
export const SCOREBOARD_BASE_H = BASE_TOTAL_H;

// Payload do realtime / refetch traz todos os campos da row, incluindo
// _short. Aceitamos parcial para sermos defensivos.
type MatchRow = Partial<ScoreboardMatch> & {
  team_a_player1_short?: string | null;
  team_a_player2_short?: string | null;
  team_b_player1_short?: string | null;
  team_b_player2_short?: string | null;
};

function pickName(
  long: string | null | undefined,
  short: string | null | undefined,
  preferShort: boolean | undefined,
): string | null | undefined {
  if (preferShort && short) return short;
  return long;
}

export function Scoreboard({
  match: initialMatch,
  tournament,
  config,
  initialState,
  preferShortNames,
  scale = 1,
  initialElapsedSeconds,
}: {
  match: ScoreboardMatch;
  tournament: ScoreboardTournament;
  config: MatchConfig;
  initialState: ScoreboardState;
  variant?: "full" | "overlay";
  /**
   * Se `true`, o realtime/refetch usam `*_short` quando disponíveis. O OBS
   * overlay activa isto para nunca cair no nome longo após uma actualização.
   */
  preferShortNames?: boolean;
  /**
   * Multiplica TODOS os pixels do scoreboard. Default 1 (nativo 735×208).
   * No OBS overlay usa-se ~2.6 para sair em 1911×541 — pixels reais grandes,
   * o YoloBox capta nessa resolução sem precisar de re-amostrar.
   */
  scale?: number;
  /**
   * Tempo decorrido em segundos (calculado no servidor a cada request).
   * Usado para o relógio render server-side em webviews sem JS — o JS,
   * quando hidrata, assume o controlo e tica de segundo a segundo.
   */
  initialElapsedSeconds?: number | null;
}) {
  // Pixels escalados — usados em vez das constantes BASE_*.
  const COL_SCORE = BASE_COL_SCORE * scale;
  const COL_SCORE_LAST = BASE_COL_SCORE_LAST * scale;
  const COL_LOGO = BASE_COL_LOGO * scale;
  const COL_MAIN = BASE_COL_MAIN * scale;
  const ROW_HEADER = BASE_ROW_HEADER * scale;
  const ROW_TEAM = BASE_ROW_TEAM * scale;
  const ROW_FOOTER = BASE_ROW_FOOTER * scale;
  const TOTAL_W = COL_LOGO + COL_MAIN;
  const TOTAL_H = ROW_HEADER + ROW_TEAM * 2 + ROW_FOOTER;
  const s = (n: number) => n * scale;
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

  // Catch-up — usa `fetch()` para o endpoint HTTP `/api/match-poll/[id]` em
  // vez do cliente Supabase JS, porque alguns webviews (YoloBox, etc.) não
  // suportam o cliente Supabase mas suportam fetch normal.
  const refetch = useCallback(async () => {
    try {
      const res = await fetch(`/api/match-poll/${initialMatch.id}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const { state: st, match: m } = (await res.json()) as {
        state: ScoreboardState | null;
        match: MatchRow | null;
      };
      if (st) setState(st);
      if (m) {
        const a1 = pickName(m.team_a_player1, m.team_a_player1_short, preferShortNames);
        const a2 = pickName(m.team_a_player2, m.team_a_player2_short, preferShortNames);
        const b1 = pickName(m.team_b_player1, m.team_b_player1_short, preferShortNames);
        const b2 = pickName(m.team_b_player2, m.team_b_player2_short, preferShortNames);
        setMatch((prev) => ({
          ...prev,
          court_name: m.court_name ?? prev.court_name,
          team_a_player1: a1 ?? prev.team_a_player1,
          team_a_player2: a2 ?? null,
          team_b_player1: b1 ?? prev.team_b_player1,
          team_b_player2: b2 ?? null,
          status: m.status ?? prev.status,
          started_at: m.started_at ?? prev.started_at,
          finished_at: m.finished_at ?? prev.finished_at,
        }));
      }
    } catch {
      // network error — próximo polling tenta de novo
    }
  }, [initialMatch.id, preferShortNames]);

  const { online, handleStatus } = useReconnect(refetch);

  // Polling de backup: alguns webviews (YoloBox, etc.) bloqueiam WebSockets
  // → o realtime do Supabase falha silenciosamente. Polling cada 3s garante
  // que o estado fica em dia mesmo sem realtime.
  useEffect(() => {
    const id = setInterval(() => {
      void refetch();
    }, 3000);
    return () => clearInterval(id);
  }, [refetch]);

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
          const m = payload.new as MatchRow;
          const a1 = pickName(m.team_a_player1, m.team_a_player1_short, preferShortNames);
          const a2 = pickName(m.team_a_player2, m.team_a_player2_short, preferShortNames);
          const b1 = pickName(m.team_b_player1, m.team_b_player1_short, preferShortNames);
          const b2 = pickName(m.team_b_player2, m.team_b_player2_short, preferShortNames);
          setMatch((prev) => ({
            ...prev,
            court_name: m.court_name ?? prev.court_name,
            team_a_player1: a1 ?? prev.team_a_player1,
            team_a_player2: a2 ?? null,
            team_b_player1: b1 ?? prev.team_b_player1,
            team_b_player2: b2 ?? null,
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

  const elapsed = useElapsedSeconds(
    inferredStartedAt,
    match.finished_at,
    initialElapsedSeconds ?? null,
  );

  const moment = useCriticalMoment(state, config);
  const completedSets = state.sets_history;
  const lastSetIdx = completedSets.length - 1;

  // Border styles — também escalam
  const borderBright = `${s(2)}px solid ${accentGlow}`;
  const borderDivider = `${s(1)}px solid rgba(255, 255, 255, 0.08)`;

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
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: s(6),
        userSelect: "none",
        fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
      }}
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
        @keyframes scoreboard-ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
        @keyframes scoreboard-blink {
          50% { opacity: 0.5; }
        }
      `}</style>

      <div
        style={{
          display: "grid",
          color: "#ffffff",
          position: "relative",
          gridTemplateColumns: `${COL_LOGO}px ${COL_MAIN}px`,
          gridTemplateRows: `${ROW_HEADER}px ${ROW_TEAM}px ${ROW_TEAM}px ${ROW_FOOTER}px`,
          // Drop-shadow reduzido — o halo grande virava "ringing" nas
          // edges depois da compressão de vídeo.
          filter: `drop-shadow(0 0 ${s(4)}px rgba(0,0,0,0.6))`,
        }}
      >
        {!online && (
          <span
            title="Sem ligação — a reconectar"
            style={{
              position: "absolute",
              top: s(4),
              right: s(6),
              zIndex: 20,
              width: s(8),
              height: s(8),
              borderRadius: "50%",
              background: "#ff5d5d",
              boxShadow: `0 0 ${s(6)}px #ff5d5d`,
            }}
          />
        )}
        {/* HEADER — linha 1, col 2 (L-shape original — sai por cima do logo) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            position: "relative",
            gridColumn: "2 / 3",
            gridRow: "1 / 2",
            background: "#2b313d",
            backgroundImage: "linear-gradient(180deg, #2b313d 0%, #1c2029 100%)",
            borderRadius: `${s(12)}px ${s(12)}px 0 0`,
            borderTop: borderBright,
            borderLeft: borderBright,
            borderRight: borderBright,
            borderBottom: borderDivider,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              flex: 1,
              paddingLeft: s(20),
              fontSize: s(18),
              fontWeight: 900,
              color: "#ffffff",
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
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
                style={{
                  display: "flex",
                  height: "100%",
                  alignItems: "center",
                  justifyContent: "center",
                  width: w,
                  borderLeft: borderDivider,
                  fontSize: s(16),
                  fontWeight: 900,
                  color: "#ffffff",
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                }}
              >
                {label}
              </div>
            );
          })}
        </div>

        {/* LOGO BOX — linhas 2-4, col 1 (L-shape — mais curta que a main) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gridColumn: "1 / 2",
            gridRow: "2 / 5",
            background: "#0a0d12",
            backgroundImage: `radial-gradient(ellipse at center, ${accent}1f 0%, transparent 55%), linear-gradient(180deg, #1d2330 0%, #0a0d12 100%)`,
            borderRadius: `${s(12)}px 0 0 ${s(12)}px`,
            borderTop: borderBright,
            borderLeft: borderBright,
            borderBottom: borderBright,
            borderRight: borderDivider,
            boxShadow:
              `inset 0 0 ${s(35)}px rgba(0,0,0,0.55), inset 0 ${s(2)}px 0 rgba(255,255,255,0.04)`,
          }}
        >
          {tournament.logo_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={tournament.logo_url}
              alt=""
              style={{
                width: s(75),
                height: s(75),
                objectFit: "contain",
                filter: `drop-shadow(0 0 ${s(8)}px ${accentGlow}cc)`,
              }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: s(75),
                height: s(75),
                background: accent,
                borderRadius: s(12),
                fontSize: s(32),
                fontWeight: 900,
                color: "#fff",
                filter: `drop-shadow(0 0 ${s(8)}px ${accentGlow}cc)`,
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
          colScore={COL_SCORE}
          colScoreLast={COL_SCORE_LAST}
          scale={scale}
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
          colScore={COL_SCORE}
          colScoreLast={COL_SCORE_LAST}
          scale={scale}
        />

        {/* FOOTER — linha 4, col 2 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gridColumn: "2 / 3",
            gridRow: "4 / 5",
            background: "#090b0e",
            borderRadius: `0 0 ${s(12)}px 0`,
            borderRight: borderBright,
            borderBottom: borderBright,
            padding: `0 ${s(20)}px`,
            gap: s(12),
          }}
        >
          {liveStatus === "finished" ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                color: "#c4f600",
                fontSize: s(16),
                fontWeight: 900,
                gap: s(6),
                letterSpacing: "0.5px",
              }}
            >
              TERMINADO
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                  width: s(18),
                  height: s(18),
                  background: "#c4f600",
                  color: "#000",
                }}
              >
                <CheckIcon style={{ width: s(12), height: s(12) }} />
              </span>
            </div>
          ) : liveStatus === "live" ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                color: "#c4f600",
                fontSize: s(16),
                fontWeight: 900,
                gap: s(8),
                letterSpacing: "0.5px",
              }}
            >
              <span
                style={{
                  position: "relative",
                  display: "inline-block",
                  width: s(8),
                  height: s(8),
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    background: "rgba(52, 211, 153, 0.7)",
                    animation: "scoreboard-ping 1s cubic-bezier(0,0,0.2,1) infinite",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    background: "#34d399",
                  }}
                />
              </span>
              LIVE
            </div>
          ) : (
            <span
              style={{
                color: "#a3b0c2",
                fontSize: s(16),
                fontWeight: 900,
                letterSpacing: "0.5px",
              }}
            >
              AGENDADO
            </span>
          )}

          {/* Moment label (golden point, match point, tiebreak...) centrado */}
          <div
            style={{
              display: "flex",
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {moment && <InlineMoment moment={moment} scale={scale} />}
          </div>

          {elapsed !== null && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                fontVariantNumeric: "tabular-nums",
                color: "#768091",
                fontSize: s(15),
                fontWeight: 800,
                gap: s(6),
              }}
            >
              <ClockIcon style={{ width: s(15), height: s(15) }} />
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
              const r = s(12); // raio dos cantos exteriores (igual ao border-radius)
              return [
                // L-shape original — contorna a forma com entalho acima do logo
                `M ${COL_LOGO},${r}`,
                `A ${r},${r} 0 0 1 ${COL_LOGO + r},0`,
                `L ${TOTAL_W - r},0`,
                `A ${r},${r} 0 0 1 ${TOTAL_W},${r}`,
                `L ${TOTAL_W},${TOTAL_H - r}`,
                `A ${r},${r} 0 0 1 ${TOTAL_W - r},${TOTAL_H}`,
                `L ${r},${TOTAL_H}`,
                `A ${r},${r} 0 0 1 0,${TOTAL_H - r}`,
                `L 0,${ROW_HEADER + r}`,
                `A ${r},${r} 0 0 1 ${r},${ROW_HEADER}`,
                `L ${COL_LOGO},${ROW_HEADER}`,
                `Z`,
              ].join(" ");
            })()}
            fill="none"
            stroke="#ffffff"
            strokeWidth={s(2)}
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
  colScore,
  colScoreLast,
  scale,
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
  colScore: number;
  colScoreLast: number;
  scale: number;
}) {
  const s = (n: number) => n * scale;
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        gridColumn: "2 / 3",
        gridRow,
        background: "#17191f",
        backgroundImage: "linear-gradient(180deg, #1c2029 0%, #12151b 100%)",
        borderRight: borderBright,
        borderBottom: isBottomRow
          ? `${s(2)}px solid rgba(0,0,0,0.6)`
          : borderDivider,
        overflow: "hidden",
      }}
    >
      {/* Nome + server indicator + badge */}
      <div
        style={{
          display: "flex",
          height: "100%",
          alignItems: "center",
          flex: 1,
          paddingLeft: s(20),
          gap: s(10),
        }}
      >
        {serving ? (
          <span
            style={{
              position: "relative",
              display: "inline-block",
              flexShrink: 0,
              width: s(10),
              height: s(10),
            }}
          >
            <span
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: "rgba(250, 204, 21, 0.7)",
                animation: "scoreboard-ping 1s cubic-bezier(0,0,0.2,1) infinite",
              }}
            />
            <span
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: "#facc15",
              }}
            />
          </span>
        ) : (
          <span
            style={{
              display: "inline-block",
              flexShrink: 0,
              borderRadius: "50%",
              width: s(10),
              height: s(10),
              background: "rgba(255,255,255,0.1)",
            }}
          />
        )}
        <span
          style={{
            fontSize: s(22),
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
              fontSize: s(14),
              fontWeight: 900,
              padding: `${s(6)}px ${s(11)}px`,
              borderRadius: s(5),
              marginLeft: s(14),
              letterSpacing: "0.5px",
              boxShadow: `0 0 ${s(15)}px rgba(196,246,0,0.35)`,
            }}
          >
            VENCEDOR
          </span>
        )}
      </div>

      {/* Score columns */}
      {scoreCols.map((col, i) => {
        const isLast = i === lastColIdx;
        const w = isLast ? colScoreLast : colScore;

        let value: string | number = "";
        let scoreState: "dim" | "active" | "glow" | "tiebreak" = "dim";
        let fontSize = s(30);

        if (col.kind === "set") {
          value = col.value;
          const won = col.value > col.opponentValue;
          if (isMatchOver && col.index === lastSetIdx && won) {
            scoreState = "glow";
            fontSize = s(34);
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
          styleColor.color = "#64748b"; // cinzento mais claro p/ contraste pós-compressão
        } else if (scoreState === "active") {
          styleColor.color = "#ffffff";
          // Sem text-shadow — virava halo borrado depois da compressão
        } else if (scoreState === "glow") {
          styleColor.color = "#ffffff";
          // Glow só no vencedor — mais subtil para sobreviver à compressão
          styleColor.textShadow = `0 0 ${s(6)}px ${accentGlow}`;
        } else if (scoreState === "tiebreak") {
          styleColor.color = "#fbbf24";
        }

        if (flash && col.kind === "points") {
          styleColor.color = "#c4f600";
        }

        return (
          <div
            key={i}
            style={{
              display: "flex",
              height: "100%",
              alignItems: "center",
              justifyContent: "center",
              fontVariantNumeric: "tabular-nums",
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

function InlineMoment({ moment, scale = 1 }: { moment: Moment; scale?: number }) {
  const s = (n: number) => n * scale;
  // Cores mais saturadas + texto branco para legibilidade pós-compressão.
  const colors: Record<MomentColor, { bg: string; fg: string }> = {
    red: { bg: "#dc2626", fg: "#ffffff" },
    orange: { bg: "#ea580c", fg: "#ffffff" },
    yellow: { bg: "#eab308", fg: "#0a0d12" },
    amber: { bg: "#f59e0b", fg: "#0a0d12" },
  };
  const c = colors[moment.color];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: s(6),
        background: c.bg,
        color: c.fg,
        borderRadius: s(4),
        padding: `${s(4)}px ${s(12)}px`,
        fontSize: s(14),
        fontWeight: 900,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
      }}
    >
      {moment.team !== "both" && (
        <span style={{ opacity: 0.7 }}>{moment.team}</span>
      )}
      <span
        style={{
          animation: "scoreboard-blink 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        }}
      >
        {moment.label}
      </span>
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
  fallback: number | null = null,
): number | null {
  // `fallback` é calculado no servidor (Date.now() - started_at) e usado
  // até o JS hidratar e o useEffect arrancar. Crítico para webviews sem
  // JS (YoloBox) — o tempo no HTML inicial já vem com o valor certo, e
  // a cada meta-refresh é re-calculado.
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

  if (!startedAt) return null;
  if (now === null) return fallback; // SSR / webview sem JS: usa o valor do servidor
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
