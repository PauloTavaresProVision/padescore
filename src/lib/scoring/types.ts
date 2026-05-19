export type TeamSide = "A" | "B";

/**
 * Configuração de scoring de um jogo de padel.
 *
 * - `goldenPoint`: se true, em 40-40 o ponto seguinte decide (morte súbita).
 *                 Se false, joga-se com vantagens (AD).
 * - `setsToWin`: número de sets que cada equipa precisa para ganhar o encontro.
 *                2 = best of 3 (típico), 3 = best of 5.
 * - `gamesPerSet`: games necessários para tentar fechar um set (6).
 * - `tiebreakAt`: empate em games que dispara o tiebreak (6 → tiebreak a 6-6).
 * - `tiebreakPoints`: pontos para ganhar o tiebreak normal (7).
 * - `finalSetSuperTiebreak`: se true, em vez de jogar o último set joga-se
 *                            um super tiebreak a 10 pontos.
 */
export interface MatchConfig {
  goldenPoint: boolean;
  setsToWin: number;
  gamesPerSet: number;
  tiebreakAt: number;
  tiebreakPoints: number;
  finalSetSuperTiebreak: boolean;
}

export const DEFAULT_CONFIG: MatchConfig = {
  goldenPoint: true,
  setsToWin: 2,
  gamesPerSet: 6,
  tiebreakAt: 6,
  tiebreakPoints: 7,
  finalSetSuperTiebreak: false,
};

/**
 * `pointsA` / `pointsB` são strings porque podem ser
 * '0' | '15' | '30' | '40' | 'AD' (game normal)
 * ou números como string '0','1','2',...,'12' (em tiebreak).
 * O UI deve interpretar consoante `inTiebreak || inSuperTiebreak`.
 */
export interface MatchState {
  pointsA: string;
  pointsB: string;
  gamesA: number;
  gamesB: number;
  setsA: number;
  setsB: number;
  setsHistory: { a: number; b: number }[];
  server: TeamSide;
  inTiebreak: boolean;
  inSuperTiebreak: boolean;
  isFinished: boolean;
  winner: TeamSide | null;
}

export type MatchEvent =
  | { type: "point"; team: TeamSide }
  | { type: "manual"; payload: Partial<MatchState> };
