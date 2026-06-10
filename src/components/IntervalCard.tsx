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
//
// DIMENSIONAMENTO 100% CSS (sem JS): a unidade base é
//   --u = min(size·100vw/1780, 100vh/360)
// e todas as medidas do design são calc(var(--u) · N). Resultado: o cartão
// ocupa `size` da largura do Browser Source/janela, nunca excede a altura,
// e nunca corta — em qualquer resolução, com ou sem JavaScript.
// =============================================================================

import type {
  ScoreboardMatch,
  ScoreboardTournament,
  ScoreboardState,
} from "./Scoreboard";

const LIME = "#d7ff00";

// Dimensões do design (unidades base).
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
  size = 0.6,
}: {
  match: ScoreboardMatch & { category?: string | null };
  tournament: ScoreboardTournament;
  state: ScoreboardState;
  /** Calculado no servidor a cada request (o polling re-renderiza). */
  elapsedSeconds: number | null;
  /** Logo do sponsor no canto inferior direito (ex.: /byte-digital.png). */
  sponsorUrl?: string | null;
  /** Fracção da largura da janela que o cartão ocupa (0.1–1, default 0.6). */
  size?: number;
}) {
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

  const css = buildCss(size, n);

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
            <span
              style={{
                fontSize: "calc(var(--u) * 64)",
                fontWeight: 900,
                color: "#fff",
              }}
            >
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
// CSS do designer, em unidades --u (1/1780 da largura ocupada) — sem px fixos
// =============================================================================

function buildCss(size: number, nSets: number): string {
  // u(n): n unidades do design → comprimento real via CSS var.
  const u = (n: number) => `calc(var(--u) * ${n})`;

  return `
#sb-mount {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.scoreboard {
  --u: min(${size} * 100vw / ${INTERVAL_BASE_W}, 100vh / ${INTERVAL_BASE_H});
  width: ${u(1780)};
  height: ${u(360)};
  flex-shrink: 0;
  display: grid;
  grid-template-columns: ${u(300)} 1fr ${u(340)};
  background: rgba(0, 0, 0, 0.88);
  border: ${u(2)} solid rgba(255, 255, 255, 0.45);
  border-radius: ${u(28)};
  overflow: hidden;
  box-shadow: 0 ${u(16)} ${u(45)} rgba(0, 0, 0, 0.55);
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
  padding: ${u(26)};
  min-width: 0;
  /* overflow hidden + min-height 0: sem isto, o tamanho intrínseco do
     conteúdo (logo, fontes) força a linha do grid a crescer para lá da
     altura do cartão e o rodapé sai cortado. */
  min-height: 0;
  overflow: hidden;
}
.event-logo { width: 100%; height: 100%; object-fit: contain; }

.center-panel {
  display: grid;
  grid-template-rows: ${u(60)} 1fr ${u(52)};
  background: rgba(5, 5, 5, 0.94);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.match-title {
  background: linear-gradient(90deg, #ffffff 0%, #e8e8e8 78%, #cfcfcf 100%);
  color: #070707;
  font-size: ${u(28)};
  font-weight: 900;
  letter-spacing: ${u(1)};
  text-transform: uppercase;
  display: flex;
  align-items: center;
  padding-left: ${u(38)};
  position: relative;
  overflow: hidden;
  white-space: nowrap;
}
.title-edge {
  position: absolute;
  right: 0;
  top: 0;
  width: ${u(120)};
  height: 100%;
  background: linear-gradient(135deg, transparent 0%, rgba(0,0,0,0.18) 100%);
  clip-path: polygon(20% 0, 100% 0, 100% 100%, 0 100%);
}

.score-rows { display: grid; grid-template-rows: 1fr 1fr; min-width: 0; min-height: 0; overflow: hidden; }

.player-row {
  display: grid;
  grid-template-columns: 1fr repeat(${nSets}, ${u(120)});
  border-bottom: 1px solid rgba(210, 245, 0, 0.8);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.player-row:last-child { border-bottom: none; }

.player-name {
  position: relative;
  display: flex;
  align-items: center;
  padding: 0 ${u(34)};
  color: #ffffff;
  font-size: calc(var(--u) * 34 * var(--fit, 1));
  font-weight: 900;
  letter-spacing: ${u(0.5)};
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
  top: ${u(18)};
  bottom: ${u(18)};
  width: ${u(14)};
  background: ${LIME};
  border-radius: 0 ${u(8)} ${u(8)} 0;
}

.serve-dot {
  width: ${u(18)};
  height: ${u(18)};
  background: ${LIME};
  border-radius: 50%;
  margin-left: ${u(18)};
  flex-shrink: 0;
}

.score-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: ${u(66)};
  line-height: 1;
  font-weight: 900;
  border-left: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(15, 15, 15, 0.82);
  font-variant-numeric: tabular-nums;
  min-height: 0;
}

.bottom-bar {
  background: linear-gradient(90deg, #f5f5f5 0%, #dcdcdc 100%);
  color: #5f5f5f;
  font-size: ${u(20)};
  font-weight: 900;
  letter-spacing: ${u(7)};
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
  padding: ${u(34)} ${u(24)} ${u(24)};
  gap: ${u(18)};
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.duration-title {
  color: #ffffff;
  font-size: ${u(24)};
  font-weight: 900;
  letter-spacing: ${u(2)};
  text-transform: uppercase;
  text-align: center;
}

.duration-box {
  width: 100%;
  border: ${u(2)} solid ${LIME};
  border-radius: ${u(16)};
  padding: ${u(16)} ${u(12)};
  color: ${LIME};
  font-size: ${u(34)};
  font-weight: 900;
  text-align: center;
  background: rgba(255, 255, 255, 0.04);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.match-status {
  color: #ffffff;
  font-size: ${u(20)};
  font-weight: 900;
  letter-spacing: ${u(2)};
  text-transform: uppercase;
  text-align: center;
  opacity: 0.9;
}

.sponsor-logo {
  margin-top: auto;
  width: 100%;
  height: ${u(78)};
  display: flex;
  align-items: center;
  justify-content: center;
}
.sponsor-logo img { max-width: 90%; max-height: ${u(78)}; object-fit: contain; }
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
