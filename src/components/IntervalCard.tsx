// =============================================================================
// OBS — CARTÃO DE INTERVALO (tradução 1:1 do HTML do designer)
// -----------------------------------------------------------------------------
// Caixa ÚNICA com 3 secções em grid (logo | marcador | duração+sponsor),
// separadas por linhas finas — não são painéis soltos:
//
//   ┌────────┬──────────────────────────────────────┬───────────────┐
//   │        │ M1 OPEN MASCULINO                  ▚ │ DURAÇÃO DO    │
//   │  logo  │ ▌CARLOS SOUSA / SERGIO V ●  1  7  10 │ ┌───────────┐ │
//   │        │ ─────────────lime──────────────────── │ │ 1H 27MIN  │ │
//   │        │  NICOLAU M. / WOJTEK D      7  6   7 │ │ terminado   │
//   │        │ ▓ STANDARD BANK OPEN PADEL           │ │   sponsor   │
//   └────────┴──────────────────────────────────────┴───────────────┘
//
// Componente PURO (sem hooks): o refresh vem do polling do layout /obs.
// O CSS vem num <style> embebido (multiplicado por `scale`), incluindo a
// media query do designer que compacta o cartão abaixo de 1400px.
// =============================================================================

import type {
  ScoreboardMatch,
  ScoreboardTournament,
  ScoreboardState,
} from "./Scoreboard";

const LIME = "#d7ff00";

// Dimensões do design (scale=1). Em janelas mais estreitas que isto, a
// página aplica zoom-to-fit (encolhe o cartão inteiro sem cortar nada).
export const INTERVAL_BASE_W = 1780;
export const INTERVAL_BASE_H = 360;

const CATEGORY_LABELS: Record<string, string> = {
  M1: "M1 Open Masculino",
  M2: "M2 Open Masculino",
  M3: "M3 Open Masculino",
  M4: "M4 Open Masculino",
  F1: "F1 Open Feminino",
  F2: "F2 Open Feminino",
  F3: "F3 Open Feminino",
  F4: "F4 Open Feminino",
};

export function IntervalCard({
  match,
  tournament,
  state,
  elapsedSeconds,
  sponsorUrl,
  scale = 1,
}: {
  match: ScoreboardMatch & { category?: string | null };
  tournament: ScoreboardTournament;
  state: ScoreboardState;
  /** Calculado no servidor a cada request (o polling re-renderiza). */
  elapsedSeconds: number | null;
  /** Logo do sponsor no canto inferior direito (ex.: /byte-digital.png). */
  sponsorUrl?: string | null;
  scale?: number;
}) {
  const s = (n: number) => Math.round(n * scale * 100) / 100;

  // Sets: completos + corrente (se decorre). Mínimo 1 coluna.
  const sets: { a: number; b: number }[] = [...state.sets_history];
  if (
    !state.is_finished &&
    (state.games_a > 0 || state.games_b > 0 || sets.length === 0)
  ) {
    sets.push({ a: state.games_a, b: state.games_b });
  }
  if (sets.length === 0) sets.push({ a: state.games_a, b: state.games_b });

  // Linha destacada (lime + barra + bola): vencedor se terminou, senão quem serve.
  const active: "A" | "B" =
    (state.is_finished ? state.winner : state.server) ?? "A";

  const nameA = teamName(match.team_a_player1, match.team_a_player2);
  const nameB = teamName(match.team_b_player1, match.team_b_player2);

  const categoryLabel = match.category
    ? (CATEGORY_LABELS[match.category] ?? match.category)
    : match.court_name || tournament.name;

  // Auto-shrink dos nomes: nomes longos encolhem a letra (só nessa linha) em
  // vez de cortar com "…" (~0.76em por carácter em Arial 900 uppercase, já
  // com folga para o letter-spacing).
  const n = sets.length;
  const fit = (name: string, hasDot: boolean) => {
    const chars = Math.max(1, name.length);
    const avail = 1780 - 300 - 340 - 120 * n - 68 - (hasDot ? 36 : 0);
    return Math.max(0.6, Math.min(1, avail / (0.76 * chars * 34)));
  };

  const css = buildCss(s, n);

  return (
    <div>
      <style>{css}</style>
      <div className="scoreboard">
        {/* ============ LOGO ============ */}
        <div className="left-panel">
          {tournament.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="event-logo" src={tournament.logo_url} alt="" />
          ) : (
            <span style={{ fontSize: s(64), fontWeight: 900, color: "#fff" }}>
              {tournament.name.slice(0, 1)}
            </span>
          )}
        </div>

        {/* ============ MARCADOR ============ */}
        <div className="center-panel">
          <div className="match-title">
            {categoryLabel}
            <span className="title-edge" />
          </div>

          <div className="score-rows">
            <TeamRowHtml
              name={nameA}
              scores={sets.map((x) => x.a)}
              active={active === "A"}
              fit={fit(nameA, active === "A")}
            />
            <TeamRowHtml
              name={nameB}
              scores={sets.map((x) => x.b)}
              active={active === "B"}
              fit={fit(nameB, active === "B")}
            />
          </div>

          <div className="bottom-bar">{tournament.name}</div>
        </div>

        {/* ============ DURAÇÃO + SPONSOR ============ */}
        <div className="right-panel">
          <div className="duration-title">Duração do Jogo</div>
          <div className="duration-box">{formatDuration(elapsedSeconds)}</div>
          <div className="match-status">
            {state.is_finished ? "Jogo Terminado" : "Em Curso"}
          </div>
          {sponsorUrl && (
            <div className="sponsor-logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sponsorUrl} alt="" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TeamRowHtml({
  name,
  scores,
  active,
  fit,
}: {
  name: string;
  scores: number[];
  active: boolean;
  /** Factor de encolhimento da letra (1 = tamanho do design). */
  fit: number;
}) {
  return (
    <div
      className={active ? "player-row active" : "player-row"}
      style={{ "--fit": fit.toFixed(3) } as React.CSSProperties}
    >
      <div className="player-name">
        <span className="player-name-text">{name}</span>
        {active && <span className="serve-dot" />}
      </div>
      {scores.map((v, i) => (
        <div key={i} className="score-cell">
          {v}
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// CSS do designer, parametrizado por scale e nº de sets
// =============================================================================

function buildCss(s: (n: number) => number, nSets: number): string {
  return `
.scoreboard {
  width: ${s(1780)}px;
  height: ${s(360)}px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: ${s(300)}px 1fr ${s(340)}px;
  background: rgba(0, 0, 0, 0.88);
  border: ${s(2)}px solid rgba(255, 255, 255, 0.45);
  border-radius: ${s(28)}px;
  overflow: hidden;
  box-shadow: 0 ${s(16)}px ${s(45)}px rgba(0, 0, 0, 0.55);
  font-family: Arial, Helvetica, sans-serif;
  box-sizing: border-box;
}
.scoreboard *, .scoreboard *::before, .scoreboard *::after { box-sizing: border-box; }

.left-panel {
  background: rgba(5, 5, 5, 0.96);
  border-right: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${s(26)}px;
  min-width: 0;
}
.event-logo { width: 100%; height: 100%; object-fit: contain; }

.center-panel {
  display: grid;
  grid-template-rows: ${s(60)}px 1fr ${s(52)}px;
  background: rgba(5, 5, 5, 0.94);
  min-width: 0;
}

.match-title {
  background: linear-gradient(90deg, #ffffff 0%, #e8e8e8 78%, #cfcfcf 100%);
  color: #070707;
  font-size: ${s(28)}px;
  font-weight: 900;
  letter-spacing: ${s(1)}px;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  padding-left: ${s(38)}px;
  position: relative;
  overflow: hidden;
  white-space: nowrap;
}
.title-edge {
  position: absolute;
  right: 0;
  top: 0;
  width: ${s(120)}px;
  height: 100%;
  background: linear-gradient(135deg, transparent 0%, rgba(0,0,0,0.18) 100%);
  clip-path: polygon(20% 0, 100% 0, 100% 100%, 0 100%);
}

.score-rows { display: grid; grid-template-rows: 1fr 1fr; min-width: 0; }

.player-row {
  display: grid;
  grid-template-columns: 1fr repeat(${nSets}, ${s(120)}px);
  border-bottom: 1px solid rgba(210, 245, 0, 0.8);
  min-width: 0;
}
.player-row:last-child { border-bottom: none; }

.player-name {
  position: relative;
  display: flex;
  align-items: center;
  padding: 0 ${s(34)}px;
  color: #ffffff;
  font-size: calc(${s(34)}px * var(--fit, 1));
  font-weight: 900;
  letter-spacing: ${s(0.5)}px;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  min-width: 0;
}
.player-name-text { overflow: hidden; text-overflow: ellipsis; }
.player-row.active .player-name { color: ${LIME}; }
.player-row.active .player-name::before {
  content: "";
  position: absolute;
  left: 0;
  top: ${s(18)}px;
  bottom: ${s(18)}px;
  width: ${s(14)}px;
  background: ${LIME};
  border-radius: 0 ${s(8)}px ${s(8)}px 0;
}

.serve-dot {
  width: ${s(18)}px;
  height: ${s(18)}px;
  background: ${LIME};
  border-radius: 50%;
  margin-left: ${s(18)}px;
  flex-shrink: 0;
}

.score-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: ${s(66)}px;
  font-weight: 900;
  border-left: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(15, 15, 15, 0.82);
  font-variant-numeric: tabular-nums;
}

.bottom-bar {
  background: linear-gradient(90deg, #f5f5f5 0%, #dcdcdc 100%);
  color: #5f5f5f;
  font-size: ${s(20)}px;
  font-weight: 900;
  letter-spacing: ${s(7)}px;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  overflow: hidden;
}

.right-panel {
  background: rgba(7, 7, 7, 0.96);
  border-left: 1px solid rgba(255, 255, 255, 0.22);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: ${s(34)}px ${s(24)}px ${s(24)}px;
  gap: ${s(18)}px;
  min-width: 0;
}

.duration-title {
  color: #ffffff;
  font-size: ${s(24)}px;
  font-weight: 900;
  letter-spacing: ${s(2)}px;
  text-transform: uppercase;
  text-align: center;
}

.duration-box {
  width: 100%;
  border: ${s(2)}px solid ${LIME};
  border-radius: ${s(16)}px;
  padding: ${s(16)}px ${s(12)}px;
  color: ${LIME};
  font-size: ${s(34)}px;
  font-weight: 900;
  text-align: center;
  background: rgba(255, 255, 255, 0.04);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.match-status {
  color: #ffffff;
  font-size: ${s(20)}px;
  font-weight: 900;
  letter-spacing: ${s(2)}px;
  text-transform: uppercase;
  text-align: center;
  opacity: 0.9;
}

.sponsor-logo {
  margin-top: auto;
  width: 100%;
  height: ${s(78)}px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sponsor-logo img { max-width: 90%; max-height: ${s(78)}px; object-fit: contain; }

`;
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
