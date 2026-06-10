// =============================================================================
// OBS — CARTÃO DE INTERVALO (estilo Premier Padel)
// -----------------------------------------------------------------------------
// Painel wide para a cena de INTERVALO da transmissão (entre sets / fim de
// jogo). O operador OBS tem 2 cenas: jogo (strip/classic) e intervalo (este).
//
//   ┌────┬──────────────────────────────────────┬──────────────────┐
//   │    │ M1 OPEN MASCULINO                    │  DURAÇÃO DO JOGO │
//   │logo│ ████ CARLOS SOUSA / SERGIO VIEIRA  6 7│   ┌──────────┐  │
//   │    │ ████ NICOLAU M. / WOJTEK DOWBOR    4 6│   │ 1H 27MIN │  │
//   │    │           Standard Bank Open          │   └──────────┘  │
//   └────┴──────────────────────────────────────┴──────────────────┘
//
// Componente PURO (sem hooks): o refresh vem do polling do layout /obs que
// troca o HTML a cada 1s — a duração e os scores actualizam server-side.
// Pixels reais multiplicados por `scale` (regra YoloBox).
// =============================================================================

import type {
  ScoreboardMatch,
  ScoreboardTournament,
  ScoreboardState,
} from "./Scoreboard";

const LIME = "#C3F005";

// Dimensões BASE (scale=1). Total: 1120×150.
const BASE_LOGO_W = 140;
const BASE_MAIN_W = 660;
const BASE_RIGHT_W = 240;
const BASE_H = 150;
const BASE_HDR_H = 30;
const BASE_TEAM_H = 46;
const BASE_FOOTER_H = BASE_H - BASE_HDR_H - BASE_TEAM_H * 2; // 28

export const INTERVAL_BASE_W = BASE_LOGO_W + BASE_MAIN_W + 80 * 3 + BASE_RIGHT_W;
export const INTERVAL_BASE_H = BASE_H;

const CATEGORY_LABELS: Record<string, string> = {
  M1: "M1 OPEN MASCULINO",
  M2: "M2 OPEN MASCULINO",
  M3: "M3 OPEN MASCULINO",
  M4: "M4 OPEN MASCULINO",
  F1: "F1 OPEN FEMININO",
  F2: "F2 OPEN FEMININO",
  F3: "F3 OPEN FEMININO",
  F4: "F4 OPEN FEMININO",
};

export function IntervalCard({
  match,
  tournament,
  state,
  elapsedSeconds,
  scale = 1,
}: {
  match: ScoreboardMatch & { category?: string | null };
  tournament: ScoreboardTournament;
  state: ScoreboardState;
  /** Calculado no servidor a cada request (o polling re-renderiza). */
  elapsedSeconds: number | null;
  scale?: number;
}) {
  const s = (n: number) => n * scale;

  // Sets a mostrar: completos + o corrente (se o jogo ainda decorre e já
  // tem jogos marcados). Mínimo 1 coluna para não colapsar o layout.
  const sets: { a: number; b: number }[] = [...state.sets_history];
  if (!state.is_finished && (state.games_a > 0 || state.games_b > 0 || sets.length === 0)) {
    sets.push({ a: state.games_a, b: state.games_b });
  }
  if (sets.length === 0) sets.push({ a: state.games_a, b: state.games_b });

  const setColW = 80;
  const scoresW = sets.length * setColW;
  const totalW = BASE_LOGO_W + BASE_MAIN_W + scoresW + BASE_RIGHT_W;

  const winner: "A" | "B" | null = state.is_finished ? state.winner : null;

  const nameA = teamName(match.team_a_player1, match.team_a_player2);
  const nameB = teamName(match.team_b_player1, match.team_b_player2);

  const categoryLabel = match.category
    ? (CATEGORY_LABELS[match.category] ?? match.category)
    : match.court_name?.toUpperCase() || tournament.name.toUpperCase();

  const fontStack =
    '"Segoe UI Variable Display", "Segoe UI", "Arial Narrow", Arial, sans-serif';

  return (
    <div
      style={{
        width: s(totalW),
        height: s(BASE_H),
        display: "flex",
        fontFamily: fontStack,
        borderRadius: s(10),
        overflow: "hidden",
        background: "#E4E4E4",
        filter: "drop-shadow(0 4px 14px rgba(0,0,0,.4))",
      }}
    >
      {/* ---------- Logo do torneio ---------- */}
      <div
        style={{
          width: s(BASE_LOGO_W),
          display: "grid",
          placeItems: "center",
          background: "#D6D6D6",
          flexShrink: 0,
        }}
      >
        {tournament.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tournament.logo_url}
            alt=""
            style={{
              width: s(96),
              height: s(96),
              objectFit: "contain",
            }}
          />
        ) : (
          <span
            style={{
              fontSize: s(40),
              fontWeight: 900,
              color: "#888",
            }}
          >
            {tournament.name.slice(0, 1)}
          </span>
        )}
      </div>

      {/* ---------- Painel central: header + equipas + footer ---------- */}
      <div
        style={{
          width: s(BASE_MAIN_W + scoresW),
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        {/* Header: categoria */}
        <div
          style={{
            height: s(BASE_HDR_H),
            display: "flex",
            alignItems: "center",
            padding: `0 ${s(16)}px`,
            color: "#111",
            fontWeight: 800,
            fontSize: s(15),
            letterSpacing: s(0.8),
            textTransform: "uppercase",
          }}
        >
          {categoryLabel}
        </div>

        {/* Linha equipa A */}
        <TeamRow
          s={s}
          name={nameA}
          scores={sets.map((set) => set.a)}
          opponentScores={sets.map((set) => set.b)}
          setColW={setColW}
          isWinner={winner === "A"}
          finished={state.is_finished}
        />
        {/* Linha equipa B */}
        <TeamRow
          s={s}
          name={nameB}
          scores={sets.map((set) => set.b)}
          opponentScores={sets.map((set) => set.a)}
          setColW={setColW}
          isWinner={winner === "B"}
          finished={state.is_finished}
          gapTop
        />

        {/* Footer: nome do torneio */}
        <div
          style={{
            height: s(BASE_FOOTER_H),
            display: "grid",
            placeItems: "center",
            color: "#555",
            fontWeight: 700,
            fontSize: s(11),
            letterSpacing: s(1.4),
            textTransform: "uppercase",
          }}
        >
          {tournament.name}
        </div>
      </div>

      {/* ---------- Painel direito: duração ---------- */}
      <div
        style={{
          flex: 1,
          minWidth: s(BASE_RIGHT_W),
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: s(8),
          borderLeft: `${s(1)}px solid #C4C4C4`,
          padding: `0 ${s(14)}px`,
        }}
      >
        <div
          style={{
            color: "#111",
            fontWeight: 800,
            fontSize: s(14),
            letterSpacing: s(1.2),
            textTransform: "uppercase",
          }}
        >
          Duração do Jogo
        </div>
        <div
          style={{
            background: "#3A3A3A",
            color: "#fff",
            fontWeight: 800,
            fontSize: s(20),
            letterSpacing: s(1),
            padding: `${s(6)}px ${s(18)}px`,
            borderRadius: s(4),
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatDuration(elapsedSeconds)}
        </div>
        <div
          style={{
            color: "#777",
            fontWeight: 700,
            fontSize: s(10),
            letterSpacing: s(1.2),
            textTransform: "uppercase",
          }}
        >
          {state.is_finished ? "Jogo terminado" : "Em curso"}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Sub-componentes
// =============================================================================

function TeamRow({
  s,
  name,
  scores,
  opponentScores,
  setColW,
  isWinner,
  finished,
  gapTop,
}: {
  s: (n: number) => number;
  name: string;
  scores: number[];
  opponentScores: number[];
  setColW: number;
  isWinner: boolean;
  finished: boolean;
  gapTop?: boolean;
}) {
  return (
    <div
      style={{
        height: s(BASE_TEAM_H),
        display: "flex",
        alignItems: "stretch",
        marginTop: gapTop ? s(2) : 0,
      }}
    >
      {/* Nome (fundo preto) */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: s(10),
          background: "#101010",
          padding: `0 ${s(16)}px`,
          minWidth: 0,
        }}
      >
        <span
          style={{
            color: isWinner ? LIME : "#fff",
            fontWeight: 800,
            fontSize: s(20),
            letterSpacing: s(0.4),
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            lineHeight: 1.1,
          }}
        >
          {name}
        </span>
        {isWinner && finished && (
          <span
            style={{
              flexShrink: 0,
              width: s(10),
              height: s(10),
              borderRadius: "50%",
              background: LIME,
            }}
          />
        )}
      </div>

      {/* Scores por set (células claras) */}
      {scores.map((v, i) => {
        const won = finished
          ? v > (opponentScores[i] ?? 0)
          : i < scores.length - 1 && v > (opponentScores[i] ?? 0);
        return (
          <div
            key={i}
            style={{
              width: s(setColW),
              display: "grid",
              placeItems: "center",
              background: "#F4F4F4",
              borderLeft: `${s(2)}px solid #E4E4E4`,
              color: "#111",
              fontWeight: won ? 900 : 700,
              fontSize: s(28),
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}
          >
            {v}
          </div>
        );
      })}
    </div>
  );
}

function teamName(p1: string, p2: string | null): string {
  const a = p1.toUpperCase();
  return p2 ? `${a} / ${p2.toUpperCase()}` : a;
}

/** 5234s → "1H 27MIN" · 312s → "5MIN" · null → "—" */
function formatDuration(sec: number | null): string {
  if (sec === null || sec < 0) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}H ${String(m).padStart(2, "0")}MIN`;
  return `${m}MIN`;
}
