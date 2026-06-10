"use client";

// =============================================================================
// TV SCOREBOARD — LAYOUT "STRIP" (broadcast, estilo World Padel Tour)
// -----------------------------------------------------------------------------
// Barra compacta no canto superior esquerdo do ecrã 1920×1080:
//
//   ┌─────────────────┐┌─────┬─────┬─────┬──────┐
//   │ ● PADEL LIVE    ││ S1  │ S2  │ JG  │  PT  │
//   ├─────────────────┤├─────┼─────┼─────┼──────┤
//   │▌🎾 CARLOS S / SERGIO V │  6  │  3  │  4  │  30  │
//   │▌   NICOLAU M / WOJTEK D│  4  │  6  │  5  │  15  │
//   └─────────────────┴─────┴─────┴─────┴──────┘
//
//   S1/S2 = sets completos · JG = jogos do set em curso · PT = pontos
//   Bola junto ao nome = equipa a servir. Set ganho fica lime.
//
// O resto do ecrã mostra o tv_background_url do torneio (ou gradient dark).
// Partilha os mesmos props do TVScoreboard clássico — a página escolhe qual
// renderizar consoante tournaments.tv_layout.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useReconnect } from "@/lib/use-reconnect";
import { deriveShortName } from "@/lib/names";
import type { MatchConfig } from "@/lib/scoring/types";
import type { TVMatch, TVTournament, TVState } from "./TVScoreboard";

const LIME = "#C3F005";
const CYAN = "#19E0E0";
const DARK = "#141414";
const DARK_2 = "#1C1C1C";

const STAGE_W = 1920;
const STAGE_H = 1080;

export function TVScoreboardStrip({
  match: initialMatch,
  tournament,
  config,
  initialState,
  forceWinner,
}: {
  match: TVMatch;
  tournament: TVTournament;
  config: MatchConfig;
  initialState: TVState;
  forceWinner?: "A" | "B" | null;
  /** Aceite por compat com o layout clássico — o strip não tem standby próprio. */
  forceStandby?: boolean;
  initialElapsedSeconds?: number | null;
}) {
  const [match, setMatch] = useState<TVMatch>(initialMatch);
  const [state, setState] = useState<TVState>(initialState);
  const [flashTeam, setFlashTeam] = useState<"A" | "B" | null>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------------------
  // Realtime + catch-up (mesmo pattern do TVScoreboard clássico)
  // ---------------------------------------------------------------------
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
          "court_name, category, team_a_player1, team_a_player2, team_b_player1, team_b_player2, status, started_at, finished_at",
        )
        .eq("id", initialMatch.id)
        .single(),
    ]);
    if (st) setState(st as unknown as TVState);
    if (m) {
      const row = m as Partial<TVMatch>;
      setMatch((prev) => ({ ...prev, ...row }));
    }
  }, [initialMatch.id]);

  const { handleStatus } = useReconnect(refetch);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`tv-strip:${match.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "match_state",
          filter: `match_id=eq.${match.id}`,
        },
        (payload) => {
          const next = payload.new as unknown as TVState;
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
          flashTimeoutRef.current = setTimeout(() => setFlashTeam(null), 700);
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
          const m = payload.new as Partial<TVMatch>;
          setMatch((prev) => ({
            ...prev,
            court_name: m.court_name ?? prev.court_name,
            category: m.category ?? null,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id]);

  // ---------------------------------------------------------------------
  // Derivações
  // ---------------------------------------------------------------------
  const hasProgress =
    state.points_a !== "0" ||
    state.points_b !== "0" ||
    state.games_a > 0 ||
    state.games_b > 0 ||
    state.sets_a > 0 ||
    state.sets_b > 0 ||
    state.sets_history.length > 0;

  const preMatch =
    match.status === "scheduled" && !hasProgress && !state.is_finished;

  const winner: "A" | "B" | null =
    forceWinner ?? (state.is_finished ? state.winner : null);

  const isGoldenPoint =
    config.goldenPoint &&
    !state.in_tiebreak &&
    !state.in_super_tiebreak &&
    state.points_a === "40" &&
    state.points_b === "40";

  // Nomes curtos uppercase: "CARLOS S / SERGIO V"
  const nameA = teamLabel(match.team_a_player1, match.team_a_player2);
  const nameB = teamLabel(match.team_b_player1, match.team_b_player2);

  // S1/S2 = sets completos. JG = jogos do set em curso.
  const s1 = state.sets_history[0] ?? null;
  const s2 = state.sets_history[1] ?? null;
  // Caso raro: 3 sets completos (jogo terminado) — JG mostra o 3º set.
  const s3 = state.sets_history[2] ?? null;
  const jgA = s3 ? s3.a : state.games_a;
  const jgB = s3 ? s3.b : state.games_b;

  const ptLabel = state.in_super_tiebreak
    ? "STB"
    : state.in_tiebreak
      ? "TB"
      : "PT";

  // Scale responsivo: stage 1920×1080 centrado e escalado ao viewport
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const update = () =>
      setScale(
        Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H),
      );
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes strip-flash {
          0% { background-color: rgba(195, 240, 5, 0.45); }
          100% { background-color: transparent; }
        }
        @keyframes strip-golden {
          0%, 100% { color: #facc15; }
          50% { color: #fff3b0; }
        }
        @keyframes strip-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: STAGE_W,
          height: STAGE_H,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: "center center",
          fontFamily:
            '"Segoe UI Variable Display", "Segoe UI", "Arial Narrow", Arial, sans-serif',
        }}
      >
        {/* Fundo: gradient dark sempre. O tv_background_url do torneio é
            desenhado para o layout CLÁSSICO (tem caixas de fotos/nomes
            posicionadas) — por baixo do strip ficaria estranho. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, #0c1e3a, #050a14 70%)",
          }}
        />
        {/* Logo do torneio em marca de água ao centro */}
        {tournament.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tournament.logo_url}
            alt=""
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: 420,
              height: 420,
              objectFit: "contain",
              opacity: 0.16,
              filter: "grayscale(35%)",
            }}
          />
        )}

        {/* ================= STRIP ================= */}
        <div
          style={{
            position: "absolute",
            top: 60,
            left: 60,
            filter: "drop-shadow(0 10px 30px rgba(0,0,0,.6))",
          }}
        >
          {/* Tab PADEL LIVE */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              background: LIME,
              color: "#101400",
              fontWeight: 800,
              fontSize: 28,
              letterSpacing: "1px",
              padding: "10px 26px 8px 20px",
              borderRadius: "14px 14px 0 0",
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                border: "4px solid #101400",
                background: state.is_finished ? "transparent" : "#101400",
                animation: state.is_finished
                  ? undefined
                  : "strip-pulse 1.6s ease-in-out infinite",
              }}
            />
            {match.court_name ? `PADEL LIVE` : "PADEL LIVE"}
          </div>

          {/* Tabela */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "620px 110px 110px 110px 128px",
              gridTemplateRows: "52px 104px 104px",
              borderRadius: "0 14px 14px 14px",
              overflow: "hidden",
            }}
          >
            {/* Header row */}
            <div /> {/* célula vazia sobre os nomes */}
            <HeaderCell>S1</HeaderCell>
            <HeaderCell>S2</HeaderCell>
            <HeaderCell>JG</HeaderCell>
            <div
              style={{
                display: "grid",
                placeItems: "center",
                background: LIME,
                color: "#101400",
                fontWeight: 800,
                fontSize: 26,
                letterSpacing: "1px",
                borderRadius: "14px 14px 0 0",
              }}
            >
              {ptLabel}
            </div>

            {/* Row A */}
            <NameCell
              name={nameA}
              barColor={CYAN}
              serving={!preMatch && !state.is_finished && state.server === "A"}
              isWinner={winner === "A"}
              flash={flashTeam === "A"}
              roundTop
            />
            <ScoreCell value={s1 ? s1.a : null} won={!!s1 && s1.a > s1.b} flash={flashTeam === "A"} />
            <ScoreCell value={s2 ? s2.a : null} won={!!s2 && s2.a > s2.b} flash={flashTeam === "A"} />
            <ScoreCell value={hasProgress || !preMatch ? jgA : null} won={!!s3 && s3.a > s3.b} flash={flashTeam === "A"} />
            <PointsCell
              value={preMatch ? "—" : state.points_a}
              golden={isGoldenPoint}
              flash={flashTeam === "A"}
              position="top"
            />

            {/* Row B */}
            <NameCell
              name={nameB}
              barColor={LIME}
              serving={!preMatch && !state.is_finished && state.server === "B"}
              isWinner={winner === "B"}
              flash={flashTeam === "B"}
              roundBottom
            />
            <ScoreCell value={s1 ? s1.b : null} won={!!s1 && s1.b > s1.a} flash={flashTeam === "B"} bottom />
            <ScoreCell value={s2 ? s2.b : null} won={!!s2 && s2.b > s2.a} flash={flashTeam === "B"} bottom />
            <ScoreCell value={hasProgress || !preMatch ? jgB : null} won={!!s3 && s3.b > s3.a} flash={flashTeam === "B"} bottom />
            <PointsCell
              value={preMatch ? "—" : state.points_b}
              golden={isGoldenPoint}
              flash={flashTeam === "B"}
              position="bottom"
            />
          </div>

          {/* Badge de estado por baixo do strip */}
          {(preMatch || state.is_finished || isGoldenPoint || state.in_super_tiebreak || state.in_tiebreak) && (
            <div
              style={{
                display: "inline-flex",
                marginTop: 14,
                background: state.is_finished
                  ? LIME
                  : isGoldenPoint
                    ? "#facc15"
                    : "rgba(20,20,20,.92)",
                color: state.is_finished || isGoldenPoint ? "#101400" : "#fff",
                fontWeight: 800,
                fontSize: 22,
                letterSpacing: "2px",
                padding: "8px 22px",
                borderRadius: 10,
                textTransform: "uppercase",
                animation:
                  preMatch || isGoldenPoint
                    ? "strip-pulse 1.4s ease-in-out infinite"
                    : undefined,
              }}
            >
              {state.is_finished
                ? `VENCEDOR: ${winner === "A" ? nameA : winner === "B" ? nameB : "—"}`
                : isGoldenPoint
                  ? "PONTO DE OURO"
                  : state.in_super_tiebreak
                    ? "SUPER TIE-BREAK"
                    : state.in_tiebreak
                      ? "TIE-BREAK"
                      : "A COMEÇAR"}
            </div>
          )}
        </div>

        {/* Rodapé discreto: campo + categoria */}
        <div
          style={{
            position: "absolute",
            left: 60,
            bottom: 48,
            display: "flex",
            gap: 14,
            alignItems: "center",
            color: "rgba(255,255,255,.85)",
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: "1px",
            textTransform: "uppercase",
            textShadow: "0 2px 10px rgba(0,0,0,.8)",
          }}
        >
          {match.court_name && (
            <span
              style={{
                background: "rgba(20,20,20,.85)",
                padding: "6px 16px",
                borderRadius: 8,
                borderLeft: `5px solid ${LIME}`,
              }}
            >
              {match.court_name}
            </span>
          )}
          {match.category && (
            <span
              style={{
                background: "rgba(20,20,20,.85)",
                padding: "6px 16px",
                borderRadius: 8,
              }}
            >
              {match.category}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Sub-componentes
// =============================================================================

function HeaderCell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        background: DARK_2,
        color: "#fff",
        fontWeight: 700,
        fontSize: 24,
        letterSpacing: "1px",
        borderRight: "1px solid #303030",
      }}
    >
      {children}
    </div>
  );
}

function NameCell({
  name,
  barColor,
  serving,
  isWinner,
  flash,
  roundTop,
  roundBottom,
}: {
  name: string;
  barColor: string;
  serving: boolean;
  isWinner: boolean;
  flash: boolean;
  roundTop?: boolean;
  roundBottom?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        background: DARK,
        padding: "0 24px 0 0",
        borderTop: roundTop ? undefined : "1px solid #2c2c2c",
        borderTopLeftRadius: roundTop ? 14 : 0,
        borderBottomLeftRadius: roundBottom ? 14 : 0,
        animation: flash ? "strip-flash 0.7s ease-out" : undefined,
      }}
    >
      {/* Barra de cor da equipa */}
      <span
        style={{
          alignSelf: "stretch",
          width: 10,
          margin: "12px 0",
          marginLeft: 14,
          borderRadius: 5,
          background: barColor,
        }}
      />
      {/* Bola de serviço (espaço reservado para o nome não saltar) */}
      <span style={{ width: 52, display: "grid", placeItems: "center" }}>
        {serving && <PadelBall />}
        {isWinner && !serving && (
          <span style={{ fontSize: 34 }}>🏆</span>
        )}
      </span>
      <span
        style={{
          color: isWinner ? LIME : "#fff",
          fontWeight: 800,
          fontSize: 34,
          letterSpacing: "0.5px",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {name}
      </span>
    </div>
  );
}

function ScoreCell({
  value,
  won,
  flash,
  bottom,
}: {
  value: number | null;
  won: boolean;
  flash: boolean;
  bottom?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        background: DARK,
        color: won ? LIME : "#fff",
        fontWeight: 800,
        fontSize: 58,
        borderRight: "1px solid #303030",
        borderTop: bottom ? "1px solid #2c2c2c" : undefined,
        animation: flash ? "strip-flash 0.7s ease-out" : undefined,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {value === null ? (
        <span style={{ color: "#4a4a4a", fontSize: 40 }}>–</span>
      ) : (
        value
      )}
    </div>
  );
}

function PointsCell({
  value,
  golden,
  flash,
  position,
}: {
  value: string;
  golden: boolean;
  flash: boolean;
  position: "top" | "bottom";
}) {
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        background: "#0D0D0D",
        color: LIME,
        fontWeight: 800,
        fontSize: 62,
        boxShadow: `inset 0 0 0 3px ${LIME}`,
        borderBottomRightRadius: position === "bottom" ? 14 : 0,
        borderTop: position === "bottom" ? "1px solid #2c2c2c" : undefined,
        animation: golden
          ? "strip-golden 0.9s ease-in-out infinite"
          : flash
            ? "strip-flash 0.7s ease-out"
            : undefined,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {value}
    </div>
  );
}

/** Bola de padel lime com risquinhas de velocidade (como na referência). */
function PadelBall() {
  return (
    <svg width="46" height="34" viewBox="0 0 46 34" fill="none">
      {/* Risquinhas de movimento */}
      <path d="M2 10h8M0 17h10M2 24h8" stroke={LIME} strokeWidth="2.6" strokeLinecap="round" />
      {/* Bola */}
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

/** "Carlos Sousa" + "Sérgio Vieira" → "CARLOS S / SERGIO V" */
function teamLabel(p1: string, p2: string | null): string {
  const a = deriveShortName(p1).toUpperCase();
  const b = p2 ? deriveShortName(p2).toUpperCase() : null;
  return b ? `${a} / ${b}` : a;
}
