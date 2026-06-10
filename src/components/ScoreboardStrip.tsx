"use client";

// =============================================================================
// OVERLAY OBS — LAYOUT "STRIP" (broadcast, estilo World Padel Tour)
// -----------------------------------------------------------------------------
// Segunda opção de overlay para transmissão (a primeira é o Scoreboard
// clássico). Fundo TRANSPARENTE, barra compacta:
//
//   ┌──────────────┐      ┌─────┬─────┬─────╔══════╗
//   │ ● PADEL LIVE │      │ S1  │ S2  │ JG  ║  PT  ║
//   ├──────────────┴──────┼─────┼─────┼─────╫──────╢
//   │▌🎾 CARLOS S / SERGIO V │  6  │  3  │  4 ║  30  ║
//   │▌   NICOLAU M / WOJTEK D│  4  │  6  │  5 ║  15  ║
//   └────────────────────┴─────┴─────┴─────╚══════╝
//
//   S1/S2 = sets completos · JG = jogos do set em curso · PT = pontos
//   Bola junto ao nome = equipa a servir. Set ganho fica lime.
//
// Segue as mesmas regras do Scoreboard clássico para o OBS/YoloBox:
//   - TODOS os pixels multiplicados por `scale` (pixels reais, sem CSS zoom)
//   - `live=false` → zero updates client-side (o layout /obs troca o HTML)
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useReconnect } from "@/lib/use-reconnect";
import type { MatchConfig } from "@/lib/scoring/types";
import type {
  ScoreboardMatch,
  ScoreboardTournament,
  ScoreboardState,
} from "./Scoreboard";

const LIME = "#C3F005";
const CYAN = "#19E0E0";
const DARK = "#161616";
const DARK_2 = "#222222";

// Dimensões BASE (scale=1). Total: 672×150.
const BASE_COL_NAMES = 400;
const BASE_COL_SET = 62;
const BASE_COL_JG = 62;
const BASE_COL_PT = 86;
const BASE_ROW_HDR = 34;
const BASE_ROW_TEAM = 58;

export const STRIP_BASE_W =
  BASE_COL_NAMES + BASE_COL_SET * 2 + BASE_COL_JG + BASE_COL_PT; // 672
export const STRIP_BASE_H = BASE_ROW_HDR + BASE_ROW_TEAM * 2; // 150

type MatchRow = Partial<ScoreboardMatch> & {
  team_a_player1_short?: string | null;
  team_a_player2_short?: string | null;
  team_b_player1_short?: string | null;
  team_b_player2_short?: string | null;
};

export function ScoreboardStrip({
  match: initialMatch,
  tournament,
  config,
  initialState,
  preferShortNames,
  scale = 1,
  live = true,
}: {
  match: ScoreboardMatch;
  tournament: ScoreboardTournament;
  config: MatchConfig;
  initialState: ScoreboardState;
  preferShortNames?: boolean;
  /** Multiplica TODOS os pixels (pixels reais — regra do OBS/YoloBox). */
  scale?: number;
  /** false no OBS: o layout /obs faz o refresh trocando o HTML inteiro. */
  live?: boolean;
  /** Aceites por compat com a page (não usados neste layout): */
  variant?: "full" | "overlay";
  initialElapsedSeconds?: number | null;
}) {
  const s = (n: number) => n * scale;

  const [match, setMatch] = useState<ScoreboardMatch>(initialMatch);
  const [state, setState] = useState<ScoreboardState>(initialState);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // -------------------------------------------------------------------------
  // Realtime (apenas live=true — em OBS o layout troca o HTML a cada 1s)
  // -------------------------------------------------------------------------
  const refetch = useCallback(async () => {
    if (!live) return;
    const supabase = createClient();
    const [{ data: st }, { data: m }] = await Promise.all([
      supabase
        .from("match_state")
        .select("*")
        .eq("match_id", initialMatch.id)
        .single(),
      supabase
        .from("matches")
        .select("*")
        .eq("id", initialMatch.id)
        .single(),
    ]);
    if (st) setState(st as unknown as ScoreboardState);
    if (m) applyMatchRow(m as MatchRow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMatch.id, live]);

  const { handleStatus } = useReconnect(refetch);

  function applyMatchRow(row: MatchRow) {
    setMatch((prev) => ({
      ...prev,
      court_name: row.court_name ?? prev.court_name,
      team_a_player1:
        (preferShortNames ? row.team_a_player1_short : null) ??
        row.team_a_player1 ??
        prev.team_a_player1,
      team_a_player2:
        (preferShortNames ? row.team_a_player2_short : null) ??
        row.team_a_player2 ??
        null,
      team_b_player1:
        (preferShortNames ? row.team_b_player1_short : null) ??
        row.team_b_player1 ??
        prev.team_b_player1,
      team_b_player2:
        (preferShortNames ? row.team_b_player2_short : null) ??
        row.team_b_player2 ??
        null,
      status: row.status ?? prev.status,
      started_at: row.started_at ?? prev.started_at,
      finished_at: row.finished_at ?? prev.finished_at,
    }));
  }

  useEffect(() => {
    if (!live) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`obs-strip:${match.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "match_state",
          filter: `match_id=eq.${match.id}`,
        },
        (payload) => setState(payload.new as unknown as ScoreboardState),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${match.id}`,
        },
        (payload) => applyMatchRow(payload.new as MatchRow),
      )
      .subscribe(handleStatus);
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id, live]);

  // -------------------------------------------------------------------------
  // Derivações
  // -------------------------------------------------------------------------
  const isGoldenPoint =
    config.goldenPoint &&
    !state.in_tiebreak &&
    !state.in_super_tiebreak &&
    state.points_a === "40" &&
    state.points_b === "40";

  const nameA = teamLabel(match.team_a_player1, match.team_a_player2);
  const nameB = teamLabel(match.team_b_player1, match.team_b_player2);

  // Cada coluna corresponde a um set: S1=set 1, S2=set 2, JG=set 3.
  // O set EM CURSO aparece na sua própria coluna (a actualizar ao vivo);
  // sets ainda não jogados ficam "–". Highlight lime só em sets COMPLETOS
  // ganhos por essa equipa.
  const currentIdx = state.is_finished ? -1 : state.sets_history.length;
  const setCol = (i: number): { a: number; b: number; done: boolean } | null => {
    const done = state.sets_history[i];
    if (done) return { ...done, done: true };
    if (i === currentIdx) return { a: state.games_a, b: state.games_b, done: false };
    return null;
  };
  const s1 = setCol(0);
  const s2 = setCol(1);
  const s3 = setCol(2);

  const winner: "A" | "B" | null = state.is_finished ? state.winner : null;

  const ptHeader = state.in_super_tiebreak
    ? "STB"
    : state.in_tiebreak
      ? "TB"
      : "PT";

  const fontStack =
    '"Segoe UI Variable Display", "Segoe UI", "Arial Narrow", Arial, sans-serif';

  return (
    <div
      style={{
        width: s(STRIP_BASE_W),
        height: s(STRIP_BASE_H),
        fontFamily: fontStack,
        display: "grid",
        gridTemplateColumns: `${s(BASE_COL_NAMES)}px ${s(BASE_COL_SET)}px ${s(BASE_COL_SET)}px ${s(BASE_COL_JG)}px ${s(BASE_COL_PT)}px`,
        gridTemplateRows: `${s(BASE_ROW_HDR)}px ${s(BASE_ROW_TEAM)}px ${s(BASE_ROW_TEAM)}px`,
        filter: "drop-shadow(0 3px 10px rgba(0,0,0,.45))",
        // Fundo 100% transparente — só as células têm cor.
        background: "transparent",
      }}
    >
      {/* ---------- Header row ---------- */}
      {/* Tab com o nome do torneio (na coluna dos nomes; resto transparente) */}
      <div style={{ display: "flex", alignItems: "flex-end", minWidth: 0 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: s(7),
            maxWidth: "100%",
            background: LIME,
            color: "#101400",
            fontWeight: 800,
            fontSize: s(14),
            letterSpacing: s(0.6),
            padding: `${s(7)}px ${s(14)}px ${s(5)}px ${s(11)}px`,
            borderRadius: `${s(8)}px ${s(8)}px 0 0`,
            textTransform: "uppercase",
            lineHeight: 1,
          }}
        >
          <span
            style={{
              width: s(9),
              height: s(9),
              borderRadius: "50%",
              border: `${s(2.5)}px solid #101400`,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {tournament.name || "PADEL LIVE"}
          </span>
        </div>
      </div>
      <HeaderCell s={s} first>
        S1
      </HeaderCell>
      <HeaderCell s={s}>S2</HeaderCell>
      <HeaderCell s={s}>JG</HeaderCell>
      <div
        style={{
          display: "grid",
          placeItems: "center",
          background: LIME,
          color: "#101400",
          fontWeight: 800,
          fontSize: s(15),
          letterSpacing: s(0.8),
          borderRadius: `${s(8)}px ${s(8)}px 0 0`,
        }}
      >
        {ptHeader}
      </div>

      {/* ---------- Row A ---------- */}
      <NameCell
        s={s}
        name={nameA}
        barColor={CYAN}
        serving={!state.is_finished && state.server === "A"}
        isWinner={winner === "A"}
        roundTop
      />
      <ScoreCell s={s} value={s1 ? s1.a : null} won={!!s1?.done && s1.a > s1.b} />
      <ScoreCell s={s} value={s2 ? s2.a : null} won={!!s2?.done && s2.a > s2.b} />
      <ScoreCell s={s} value={s3 ? s3.a : null} won={!!s3?.done && s3.a > s3.b} />
      <PointsCell s={s} value={state.points_a} golden={isGoldenPoint} />

      {/* ---------- Row B ---------- */}
      <NameCell
        s={s}
        name={nameB}
        barColor={LIME}
        serving={!state.is_finished && state.server === "B"}
        isWinner={winner === "B"}
        roundBottom
        borderTop
      />
      <ScoreCell s={s} value={s1 ? s1.b : null} won={!!s1?.done && s1.b > s1.a} borderTop />
      <ScoreCell s={s} value={s2 ? s2.b : null} won={!!s2?.done && s2.b > s2.a} borderTop />
      <ScoreCell s={s} value={s3 ? s3.b : null} won={!!s3?.done && s3.b > s3.a} borderTop />
      <PointsCell s={s} value={state.points_b} golden={isGoldenPoint} bottom />
    </div>
  );
}

// =============================================================================
// Sub-componentes
// =============================================================================

function HeaderCell({
  s,
  first,
  children,
}: {
  s: (n: number) => number;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        background: DARK_2,
        color: "#fff",
        fontWeight: 700,
        fontSize: s(14),
        letterSpacing: s(0.5),
        borderRight: `1px solid #383838`,
        borderTopLeftRadius: first ? s(8) : 0,
      }}
    >
      {children}
    </div>
  );
}

function NameCell({
  s,
  name,
  barColor,
  serving,
  isWinner,
  roundTop,
  roundBottom,
  borderTop,
}: {
  s: (n: number) => number;
  name: string;
  barColor: string;
  serving: boolean;
  isWinner: boolean;
  roundTop?: boolean;
  roundBottom?: boolean;
  borderTop?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: DARK,
        paddingRight: s(12),
        borderTop: borderTop ? "1px solid #303030" : undefined,
        borderTopLeftRadius: roundTop ? s(8) : 0,
        borderBottomLeftRadius: roundBottom ? s(8) : 0,
        overflow: "hidden",
      }}
    >
      {/* Barra de cor da equipa */}
      <span
        style={{
          alignSelf: "stretch",
          width: s(6),
          margin: `${s(8)}px 0 ${s(8)}px ${s(8)}px`,
          borderRadius: s(3),
          background: barColor,
          flexShrink: 0,
        }}
      />
      {/* Slot fixo p/ bola de serviço ou troféu (nome não salta) */}
      <span
        style={{
          width: s(34),
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        {serving && <PadelBall s={s} />}
        {isWinner && (
          <span style={{ fontSize: s(18), lineHeight: 1 }}>🏆</span>
        )}
      </span>
      <span
        style={{
          color: isWinner ? LIME : "#fff",
          fontWeight: 800,
          fontSize: s(20),
          letterSpacing: s(0.3),
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          lineHeight: 1.1,
        }}
      >
        {name}
      </span>
    </div>
  );
}

function ScoreCell({
  s,
  value,
  won,
  borderTop,
}: {
  s: (n: number) => number;
  value: number | null;
  won: boolean;
  borderTop?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        background: DARK,
        color: won ? LIME : "#fff",
        fontWeight: 800,
        fontSize: s(30),
        borderRight: `1px solid #383838`,
        borderTop: borderTop ? "1px solid #303030" : undefined,
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1,
      }}
    >
      {value === null ? (
        <span style={{ color: "#4a4a4a", fontSize: s(20) }}>–</span>
      ) : (
        value
      )}
    </div>
  );
}

function PointsCell({
  s,
  value,
  golden,
  bottom,
}: {
  s: (n: number) => number;
  value: string;
  golden: boolean;
  bottom?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        background: "#0D0D0D",
        color: golden ? "#facc15" : LIME,
        fontWeight: 800,
        fontSize: s(32),
        boxShadow: `inset 0 0 0 ${s(2)}px ${LIME}`,
        borderBottomRightRadius: bottom ? s(8) : 0,
        borderTop: bottom ? "1px solid #303030" : undefined,
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1,
      }}
    >
      {value}
    </div>
  );
}

/** Bola de padel lime com risquinhas de velocidade. */
function PadelBall({ s }: { s: (n: number) => number }) {
  const w = s(28);
  const h = s(20);
  return (
    <svg width={w} height={h} viewBox="0 0 46 34" fill="none">
      <path
        d="M2 10h8M0 17h10M2 24h8"
        stroke={LIME}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="29" cy="17" r="13" fill={LIME} />
      <path
        d="M20 8.5 C26 13 26 21 20 25.5 M38 8.5 C32 13 32 21 38 25.5"
        stroke="#101400"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Nomes já vêm curtos da page OBS — junta e mete em maiúsculas. */
function teamLabel(p1: string, p2: string | null): string {
  const a = p1.toUpperCase();
  return p2 ? `${a} / ${p2.toUpperCase()}` : a;
}
