import {
  DEFAULT_CONFIG,
  type MatchConfig,
  type MatchEvent,
  type MatchState,
  type TeamSide,
} from "./types";

const POINT_LADDER = ["0", "15", "30", "40"] as const;

export function initialState(): MatchState {
  return {
    pointsA: "0",
    pointsB: "0",
    gamesA: 0,
    gamesB: 0,
    setsA: 0,
    setsB: 0,
    setsHistory: [],
    server: "A",
    inTiebreak: false,
    inSuperTiebreak: false,
    isFinished: false,
    winner: null,
  };
}

export function applyEvent(
  state: MatchState,
  event: MatchEvent,
  config: MatchConfig = DEFAULT_CONFIG,
): MatchState {
  if (state.isFinished) return state;

  if (event.type === "manual") {
    return { ...state, ...event.payload };
  }

  // point
  if (state.inTiebreak || state.inSuperTiebreak) {
    return applyPointInTiebreak(state, event.team, config);
  }
  return applyPointInGame(state, event.team, config);
}

/**
 * Reduce a sequence of events into the final state.
 * `events` should be the events ordered by `seq`, with `voided` ones already removed.
 */
export function reduceEvents(
  events: MatchEvent[],
  config: MatchConfig = DEFAULT_CONFIG,
): MatchState {
  let s = initialState();
  for (const e of events) {
    s = applyEvent(s, e, config);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Internal: game logic (normal — não tiebreak)
// ---------------------------------------------------------------------------

function applyPointInGame(
  state: MatchState,
  team: TeamSide,
  config: MatchConfig,
): MatchState {
  const myKey = team === "A" ? "pointsA" : "pointsB";
  const opKey = team === "A" ? "pointsB" : "pointsA";
  const my = state[myKey];
  const op = state[opKey];

  // 1. Eu tinha vantagem → ganho o game.
  if (my === "AD") return winGame(state, team, config);

  // 2. Adversário tinha vantagem → volta a 40-40 (iguais).
  //    (Tem de vir ANTES de "my=40 e op<40", caso contrário "AD" é tratado como <40.)
  if (op === "AD") return { ...state, [opKey]: "40" };

  // 3. Empate a 40.
  if (my === "40" && op === "40") {
    if (config.goldenPoint) return winGame(state, team, config);
    return { ...state, [myKey]: "AD" };
  }

  // 4. Estou em 40 e adversário <40 → ganho o game.
  if (my === "40") return winGame(state, team, config);

  // 5. Avanço normal (0→15, 15→30, 30→40).
  const idx = POINT_LADDER.indexOf(my as (typeof POINT_LADDER)[number]);
  return { ...state, [myKey]: POINT_LADDER[idx + 1] };
}

function winGame(
  state: MatchState,
  team: TeamSide,
  config: MatchConfig,
): MatchState {
  const myGamesKey = team === "A" ? "gamesA" : "gamesB";
  const myGames = state[myGamesKey] + 1;
  const opGames = team === "A" ? state.gamesB : state.gamesA;

  let s: MatchState = {
    ...state,
    pointsA: "0",
    pointsB: "0",
    [myGamesKey]: myGames,
    server: state.server === "A" ? "B" : "A",
  };

  // Tiebreak no empate (6-6)?
  if (myGames === config.tiebreakAt && opGames === config.tiebreakAt) {
    return { ...s, inTiebreak: true };
  }

  // Ganhou o set?
  if (myGames >= config.gamesPerSet && myGames - opGames >= 2) {
    return winSet(s, team, config);
  }

  return s;
}

function winSet(
  state: MatchState,
  team: TeamSide,
  config: MatchConfig,
): MatchState {
  const setsKey = team === "A" ? "setsA" : "setsB";
  const newSets = state[setsKey] + 1;
  const opSets = team === "A" ? state.setsB : state.setsA;

  const history = [...state.setsHistory, { a: state.gamesA, b: state.gamesB }];

  let s: MatchState = {
    ...state,
    pointsA: "0",
    pointsB: "0",
    gamesA: 0,
    gamesB: 0,
    setsHistory: history,
    [setsKey]: newSets,
    inTiebreak: false,
    inSuperTiebreak: false,
  };

  // Encontro terminado?
  if (newSets >= config.setsToWin) {
    return { ...s, isFinished: true, winner: team };
  }

  // Super tiebreak no set decisivo? (1-1 em best of 3, com a flag activa)
  if (config.finalSetSuperTiebreak) {
    const decidingSetCount = (config.setsToWin - 1) * 2;
    if (newSets + opSets === decidingSetCount) {
      return { ...s, inSuperTiebreak: true };
    }
  }

  return s;
}

// ---------------------------------------------------------------------------
// Internal: tiebreak (normal e super)
// ---------------------------------------------------------------------------

function applyPointInTiebreak(
  state: MatchState,
  team: TeamSide,
  config: MatchConfig,
): MatchState {
  const myKey = team === "A" ? "pointsA" : "pointsB";
  const opKey = team === "A" ? "pointsB" : "pointsA";

  const my = Number(state[myKey]) + 1;
  const op = Number(state[opKey]);
  const target = state.inSuperTiebreak ? 10 : config.tiebreakPoints;

  // Alternância de serviço no tiebreak:
  // primeiro ponto: serve o A; ponto 2-3: serve o B; ponto 4-5: A; etc.
  // → serviço muda quando (total de pontos) é ímpar.
  const total = my + op;
  const server = total % 2 === 1 ? other(state.server) : state.server;

  // Ganhou o tiebreak?
  if (my >= target && my - op >= 2) {
    if (state.inSuperTiebreak) {
      // Super tiebreak: substitui o set inteiro. Não há games normais.
      // Registamos o set com os pontos do super tiebreak (informativo).
      const setForHistory = {
        a: team === "A" ? my : op,
        b: team === "B" ? my : op,
      };
      const setsKey = team === "A" ? "setsA" : "setsB";
      const next: MatchState = {
        ...state,
        pointsA: "0",
        pointsB: "0",
        gamesA: 0,
        gamesB: 0,
        setsHistory: [...state.setsHistory, setForHistory],
        [setsKey]: state[setsKey] + 1,
        inSuperTiebreak: false,
        inTiebreak: false,
      };
      if (next.setsA >= config.setsToWin || next.setsB >= config.setsToWin) {
        return { ...next, isFinished: true, winner: team };
      }
      return next;
    }
    // Tiebreak normal: o set fecha 7-6 (incrementamos o game do vencedor).
    const myGamesKey = team === "A" ? "gamesA" : "gamesB";
    const intermediate: MatchState = {
      ...state,
      [myGamesKey]: state[myGamesKey] + 1,
      pointsA: "0",
      pointsB: "0",
    };
    return winSet(intermediate, team, config);
  }

  return {
    ...state,
    [myKey]: String(my),
    [opKey]: String(op),
    server,
  };
}

function other(t: TeamSide): TeamSide {
  return t === "A" ? "B" : "A";
}
