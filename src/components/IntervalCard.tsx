// =============================================================================
// OBS — CARTÃO DE INTERVALO (dark premium, mockup do designer)
// -----------------------------------------------------------------------------
// Painel wide para a cena de INTERVALO da transmissão. 3 painéis com moldura
// prateada sobre fundo transparente; o central é ligeiramente mais baixo e
// fica recuado (centrado na vertical), como no mockup:
//
//   ┌────────┐  ┌─────────────────────────────────────┐  ┌──────────────┐
//   │        │  │ ▓ M1 OPEN MASCULINO         ▞▞ lime │  │ DURAÇÃO DO   │
//   │  logo  │  │ ▌CARLOS SOUSA / SERGIO V ●  1  7 10 │  │    JOGO      │
//   │        │  │  NICOLAU M. / WOJTEK D      7  6  7 │  │ ┌──────────┐ │
//   │        │  │ ▓ STANDARD BANK OPEN PADEL          │  │ │ 1H 27MIN │ │
//   └────────┘  └─────────────────────────────────────┘  └──────────────┘
//
// Componente PURO (sem hooks): o refresh vem do polling do layout /obs.
// Pixels reais multiplicados por `scale` (regra YoloBox).
// =============================================================================

import type {
  ScoreboardMatch,
  ScoreboardTournament,
  ScoreboardState,
} from "./Scoreboard";

const LIME = "#C3F005";

// Dimensões BASE (scale=1) — proporções tiradas do mockup (~4.4:1).
const BASE_LOGO_W = 200;
const BASE_RIGHT_W = 250;
const BASE_NAMES_W = 560;
const BASE_SET_W = 88;
const BASE_HDR_H = 44;
const BASE_TEAM_H = 95;
const BASE_FOOTER_H = 30;
const FRAME = 4; // espessura da moldura prateada
const GAP = 14; // espaço entre painéis

// Painel central (mais baixo, recuado na vertical).
const CENTER_H = BASE_HDR_H + BASE_TEAM_H * 2 + BASE_FOOTER_H + FRAME * 2; // 272

// Painéis laterais definem a altura total.
export const INTERVAL_BASE_H = 300;
export const INTERVAL_BASE_W =
  BASE_LOGO_W +
  GAP +
  (BASE_NAMES_W + BASE_SET_W * 3 + FRAME * 2) +
  GAP +
  BASE_RIGHT_W; // 1310 com 3 sets

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

  // Sets: completos + corrente (se decorre). Mínimo 1 coluna.
  const sets: { a: number; b: number }[] = [...state.sets_history];
  if (
    !state.is_finished &&
    (state.games_a > 0 || state.games_b > 0 || sets.length === 0)
  ) {
    sets.push({ a: state.games_a, b: state.games_b });
  }
  if (sets.length === 0) sets.push({ a: state.games_a, b: state.games_b });

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
        display: "flex",
        alignItems: "center",
        gap: s(GAP),
        height: s(INTERVAL_BASE_H),
        fontFamily: fontStack,
        filter: "drop-shadow(0 6px 18px rgba(0,0,0,.55))",
      }}
    >
      {/* ================= PAINEL LOGO ================= */}
      <SilverFrame s={s} width={BASE_LOGO_W} height={INTERVAL_BASE_H}>
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "grid",
            placeItems: "center",
            padding: s(14),
            boxSizing: "border-box",
          }}
        >
          {tournament.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tournament.logo_url}
              alt=""
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
              }}
            />
          ) : (
            <span style={{ fontSize: s(64), fontWeight: 900, color: "#fff" }}>
              {tournament.name.slice(0, 1)}
            </span>
          )}
        </div>
      </SilverFrame>

      {/* ================= PAINEL CENTRAL (recuado) ================= */}
      <SilverFrame s={s} flex height={CENTER_H}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
          }}
        >
          {/* Header metálico com riscas lime */}
          <div
            style={{
              position: "relative",
              height: s(BASE_HDR_H),
              background: "linear-gradient(180deg, #FFFFFF 0%, #D7D7D7 100%)",
              display: "flex",
              alignItems: "center",
              padding: `0 ${s(24)}px`,
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                color: "#0b0b0b",
                fontWeight: 900,
                fontSize: s(20),
                letterSpacing: s(2),
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              {categoryLabel}
            </span>
            {/* Speed-lines diagonais no canto direito */}
            <Diag s={s} right={74} width={30} color="#0b0b0b" />
            <Diag s={s} right={46} width={11} color={LIME} />
            <Diag s={s} right={10} width={24} color={LIME} />
          </div>

          {/* Linha A */}
          <TeamRow
            s={s}
            name={nameA}
            scores={sets.map((x) => x.a)}
            isWinner={winner === "A"}
            finished={state.is_finished}
          />
          {/* Linha B */}
          <TeamRow
            s={s}
            name={nameB}
            scores={sets.map((x) => x.b)}
            isWinner={winner === "B"}
            finished={state.is_finished}
            divider
          />

          {/* Footer prateado */}
          <div
            style={{
              position: "relative",
              height: s(BASE_FOOTER_H),
              background: "linear-gradient(180deg, #EDEDED 0%, #C9C9C9 100%)",
              display: "grid",
              placeItems: "center",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                color: "#3c3c3c",
                fontWeight: 800,
                fontSize: s(13),
                letterSpacing: s(5),
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              {tournament.name}
            </span>
            <Diag s={s} left={14} width={10} color="#9a9a9a" />
          </div>
        </div>
      </SilverFrame>

      {/* ================= PAINEL DURAÇÃO ================= */}
      <SilverFrame s={s} width={BASE_RIGHT_W} height={INTERVAL_BASE_H}>
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: s(14),
            padding: `0 ${s(14)}px`,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              color: "#fff",
              fontWeight: 800,
              fontSize: s(16),
              letterSpacing: s(2.4),
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            Duração do Jogo
          </div>
          <div
            style={{
              border: `${s(3)}px solid ${LIME}`,
              borderRadius: s(10),
              color: LIME,
              fontWeight: 900,
              fontSize: s(30),
              letterSpacing: s(1.5),
              padding: `${s(8)}px ${s(18)}px`,
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
          >
            {formatDuration(elapsedSeconds)}
          </div>
          <div
            style={{
              color: "rgba(255,255,255,.85)",
              fontWeight: 700,
              fontSize: s(12),
              letterSpacing: s(3),
              textTransform: "uppercase",
            }}
          >
            {state.is_finished ? "Jogo terminado" : "Em curso"}
          </div>
        </div>
      </SilverFrame>
    </div>
  );
}

// =============================================================================
// Sub-componentes
// =============================================================================

/** Painel com moldura prateada (gradient) e interior preto. */
function SilverFrame({
  s,
  width,
  height,
  flex,
  children,
}: {
  s: (n: number) => number;
  width?: number;
  height: number;
  flex?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        width: width !== undefined ? s(width) : undefined,
        height: s(height),
        flex: flex ? 1 : undefined,
        flexShrink: width !== undefined ? 0 : undefined,
        background:
          "linear-gradient(135deg, #F2F2F2 0%, #B9B9B9 35%, #8E8E8E 70%, #DEDEDE 100%)",
        borderRadius: s(18),
        padding: s(FRAME),
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0B0B0B",
          borderRadius: s(14),
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function TeamRow({
  s,
  name,
  scores,
  isWinner,
  finished,
  divider,
}: {
  s: (n: number) => number;
  name: string;
  scores: number[];
  isWinner: boolean;
  finished: boolean;
  divider?: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "stretch",
        borderTop: divider ? `${s(2)}px solid #6a6a6a` : undefined,
        minHeight: 0,
      }}
    >
      {/* Barra lime do vencedor */}
      <span
        style={{
          width: s(9),
          flexShrink: 0,
          background: isWinner ? LIME : "transparent",
        }}
      />
      {/* Nome */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: s(14),
          padding: `0 ${s(16)}px`,
          minWidth: 0,
        }}
      >
        <span
          style={{
            color: isWinner ? LIME : "#fff",
            fontWeight: 800,
            fontSize: s(28),
            letterSpacing: s(0.5),
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
              width: s(16),
              height: s(16),
              borderRadius: "50%",
              background: LIME,
              boxShadow: `0 0 ${s(10)}px ${LIME}`,
            }}
          />
        )}
      </div>

      {/* Scores por set */}
      {scores.map((v, i) => (
        <div
          key={i}
          style={{
            width: s(BASE_SET_W),
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            borderLeft: `${s(2)}px solid #5a5a5a`,
            color: "#fff",
            fontWeight: 900,
            fontSize: s(46),
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          {v}
        </div>
      ))}
    </div>
  );
}

/** Risca diagonal decorativa (speed-line) nos painéis metálicos. */
function Diag({
  s,
  right,
  left,
  width,
  color,
}: {
  s: (n: number) => number;
  right?: number;
  left?: number;
  width: number;
  color: string;
}) {
  return (
    <span
      style={{
        position: "absolute",
        top: s(-6),
        bottom: s(-6),
        right: right !== undefined ? s(right) : undefined,
        left: left !== undefined ? s(left) : undefined,
        width: s(width),
        background: color,
        transform: "skewX(-24deg)",
      }}
    />
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
