import { describe, expect, it } from "vitest";
import { applyEvent, initialState, reduceEvents } from "./engine";
import { DEFAULT_CONFIG, type MatchConfig, type MatchEvent } from "./types";

const ADVANTAGES_CONFIG: MatchConfig = {
  ...DEFAULT_CONFIG,
  goldenPoint: false,
};

const SUPER_TB_CONFIG: MatchConfig = {
  ...DEFAULT_CONFIG,
  goldenPoint: false,
  finalSetSuperTiebreak: true,
};

const pointA = (n = 1): MatchEvent[] =>
  Array(n).fill({ type: "point", team: "A" });
const pointB = (n = 1): MatchEvent[] =>
  Array(n).fill({ type: "point", team: "B" });

// Gera os pontos de N games, atribuídos a A ou B conforme o padrão.
// Cada game = 4 pontos (golden point, ou sequência limpa em advantages).
function gamesForPattern(pattern: ("A" | "B")[]): MatchEvent[] {
  return pattern.flatMap((t) => (t === "A" ? pointA(4) : pointB(4)));
}

// Helper: jogos alternados começando por A — útil para chegar a 6-6.
function alternated(count: number): MatchEvent[] {
  const pattern: ("A" | "B")[] = [];
  for (let i = 0; i < count; i++) pattern.push(i % 2 === 0 ? "A" : "B");
  return gamesForPattern(pattern);
}

describe("scoring engine — basic game", () => {
  it("starts at 0-0, 0-0, 0-0", () => {
    const s = initialState();
    expect(s.pointsA).toBe("0");
    expect(s.pointsB).toBe("0");
    expect(s.gamesA).toBe(0);
    expect(s.setsA).toBe(0);
    expect(s.isFinished).toBe(false);
  });

  it("progresses 0 → 15 → 30 → 40 → game", () => {
    let s = initialState();
    s = applyEvent(s, { type: "point", team: "A" });
    expect(s.pointsA).toBe("15");
    s = applyEvent(s, { type: "point", team: "A" });
    expect(s.pointsA).toBe("30");
    s = applyEvent(s, { type: "point", team: "A" });
    expect(s.pointsA).toBe("40");
    s = applyEvent(s, { type: "point", team: "A" });
    expect(s.pointsA).toBe("0");
    expect(s.gamesA).toBe(1);
  });
});

describe("scoring engine — deuce with advantages", () => {
  it("40-40 → AD-40 → 40-40 → 40-AD → game B", () => {
    let s = reduceEvents(
      [...pointA(3), ...pointB(3)],
      ADVANTAGES_CONFIG,
    );
    expect(s.pointsA).toBe("40");
    expect(s.pointsB).toBe("40");

    s = applyEvent(s, { type: "point", team: "A" }, ADVANTAGES_CONFIG);
    expect(s.pointsA).toBe("AD");
    expect(s.pointsB).toBe("40");

    s = applyEvent(s, { type: "point", team: "B" }, ADVANTAGES_CONFIG);
    expect(s.pointsA).toBe("40");
    expect(s.pointsB).toBe("40");

    s = applyEvent(s, { type: "point", team: "B" }, ADVANTAGES_CONFIG);
    expect(s.pointsB).toBe("AD");

    s = applyEvent(s, { type: "point", team: "B" }, ADVANTAGES_CONFIG);
    expect(s.gamesB).toBe(1);
    expect(s.pointsA).toBe("0");
    expect(s.pointsB).toBe("0");
  });
});

describe("scoring engine — golden point", () => {
  it("at 40-40, next point wins the game", () => {
    let s = reduceEvents([...pointA(3), ...pointB(3)]);
    expect(s.pointsA).toBe("40");
    expect(s.pointsB).toBe("40");

    s = applyEvent(s, { type: "point", team: "B" });
    expect(s.gamesB).toBe(1);
    expect(s.pointsA).toBe("0");
    expect(s.pointsB).toBe("0");
  });
});

describe("scoring engine — set", () => {
  it("wins set 6-0", () => {
    const s = reduceEvents(pointA(24)); // 6 games × 4 pontos
    expect(s.setsA).toBe(1);
    expect(s.gamesA).toBe(0);
    expect(s.setsHistory).toEqual([{ a: 6, b: 0 }]);
  });

  it("wins set 6-4 — A vence 4 games, B vence 4 games, A vence mais 2", () => {
    const pattern: ("A" | "B")[] = [
      "A","A","A","A",      // 4-0
      "B","B","B","B",      // 4-4
      "A","A",              // 6-4 → fecha o set
    ];
    const s = reduceEvents(gamesForPattern(pattern));
    expect(s.setsA).toBe(1);
    expect(s.setsHistory[0]).toEqual({ a: 6, b: 4 });
  });

  it("at 5-5 continues to 7-5", () => {
    // 10 games alternados: ABABABABAB → 5-5
    let s = reduceEvents(alternated(10));
    expect(s.gamesA).toBe(5);
    expect(s.gamesB).toBe(5);
    expect(s.inTiebreak).toBe(false);

    // mais 2 games A → 7-5
    s = reduceEvents([...alternated(10), ...pointA(4), ...pointA(4)]);
    expect(s.setsA).toBe(1);
    expect(s.setsHistory[0]).toEqual({ a: 7, b: 5 });
  });

  it("at 6-6 enters tiebreak", () => {
    const s = reduceEvents(alternated(12));
    expect(s.gamesA).toBe(6);
    expect(s.gamesB).toBe(6);
    expect(s.inTiebreak).toBe(true);
    expect(s.pointsA).toBe("0");
    expect(s.pointsB).toBe("0");
  });
});

describe("scoring engine — tiebreak", () => {
  const setup = (): MatchEvent[] => alternated(12); // 6-6

  it("counts 0-1-2-...", () => {
    const s = reduceEvents([...setup(), ...pointA(3), ...pointB(2)]);
    expect(s.pointsA).toBe("3");
    expect(s.pointsB).toBe("2");
    expect(s.inTiebreak).toBe(true);
  });

  it("ends 7-5 → set 7-6", () => {
    const s = reduceEvents([...setup(), ...pointA(7), ...pointB(5)]);
    expect(s.setsA).toBe(1);
    expect(s.setsHistory[0]).toEqual({ a: 7, b: 6 });
    expect(s.inTiebreak).toBe(false);
  });

  it("extends past 7-6 until 2-point lead (e.g. 9-7)", () => {
    // 6-6 no tiebreak
    let s = reduceEvents([...setup(), ...pointA(6), ...pointB(6)]);
    expect(s.pointsA).toBe("6");
    expect(s.pointsB).toBe("6");
    expect(s.inTiebreak).toBe(true);

    s = applyEvent(s, { type: "point", team: "A" });
    expect(s.pointsA).toBe("7");
    expect(s.inTiebreak).toBe(true);

    s = applyEvent(s, { type: "point", team: "B" });
    expect(s.pointsB).toBe("7");

    s = applyEvent(s, { type: "point", team: "A" });
    s = applyEvent(s, { type: "point", team: "A" });
    expect(s.setsA).toBe(1);
    expect(s.setsHistory[0]).toEqual({ a: 7, b: 6 });
  });

  it("set seguinte a um tiebreak: serve o adversário de quem o abriu", () => {
    // alternated(12) → 6-6 e o servidor volta a A → A serve o 1º ponto
    // do tiebreak. Regra oficial: quem serve o 1º ponto do tiebreak
    // RECEBE no 1º game do set seguinte → o set seguinte arranca com B,
    // independentemente do ponto em que o tiebreak acaba.
    expect(reduceEvents(setup()).server).toBe("A");

    // Acaba 7-1 (ponto vencedor = nº 8):
    const end71 = reduceEvents([
      ...setup(),
      ...pointA(6),
      ...pointB(1),
      ...pointA(1),
    ]);
    expect(end71.setsHistory[0]).toEqual({ a: 7, b: 6 });
    expect(end71.inTiebreak).toBe(false);
    expect(end71.server).toBe("B");

    // Acaba 7-3 (ponto vencedor = nº 10) — continua a ser B:
    const end73 = reduceEvents([
      ...setup(),
      ...pointA(6),
      ...pointB(3),
      ...pointA(1),
    ]);
    expect(end73.setsHistory[0]).toEqual({ a: 7, b: 6 });
    expect(end73.server).toBe("B");
  });
});

describe("scoring engine — match", () => {
  it("best of 3: wins after 2 sets", () => {
    let s = reduceEvents(pointA(24)); // set 1: 6-0
    expect(s.setsA).toBe(1);
    expect(s.isFinished).toBe(false);

    s = reduceEvents(pointA(48)); // sets 1 e 2: 6-0, 6-0
    expect(s.setsA).toBe(2);
    expect(s.isFinished).toBe(true);
    expect(s.winner).toBe("A");
  });
});

describe("scoring engine — super tiebreak", () => {
  it("at 1-1 sets, plays super tiebreak to 10", () => {
    const events: MatchEvent[] = [
      ...pointA(24), // set 1: A 6-0
      ...pointB(24), // set 2: B 6-0
    ];
    let s = reduceEvents(events, SUPER_TB_CONFIG);
    expect(s.setsA).toBe(1);
    expect(s.setsB).toBe(1);
    expect(s.inSuperTiebreak).toBe(true);

    s = reduceEvents([...events, ...pointA(10)], SUPER_TB_CONFIG);
    expect(s.isFinished).toBe(true);
    expect(s.winner).toBe("A");
    expect(s.setsA).toBe(2);
  });

  it("super tiebreak goes past 10 with 2-point rule", () => {
    const events: MatchEvent[] = [
      ...pointA(24),
      ...pointB(24),
    ];
    let s = reduceEvents(
      [...events, ...pointA(9), ...pointB(9)],
      SUPER_TB_CONFIG,
    );
    expect(s.inSuperTiebreak).toBe(true);
    expect(s.pointsA).toBe("9");
    expect(s.pointsB).toBe("9");

    s = applyEvent(s, { type: "point", team: "A" }, SUPER_TB_CONFIG);
    expect(s.pointsA).toBe("10");
    expect(s.isFinished).toBe(false); // 10-9, falta 1 ponto

    s = applyEvent(s, { type: "point", team: "A" }, SUPER_TB_CONFIG);
    expect(s.isFinished).toBe(true);
    expect(s.winner).toBe("A");
  });
});

describe("scoring engine — server alternation", () => {
  it("swaps server each game", () => {
    let s = initialState();
    expect(s.server).toBe("A");
    s = reduceEvents(pointA(4));
    expect(s.server).toBe("B");
    s = reduceEvents([...pointA(4), ...pointB(4)]);
    expect(s.server).toBe("A");
  });

  it("alternates serve in tiebreak — change at points 1, 3, 5, ...", () => {
    const setup = alternated(12); // 6-6, 12 games → server volta ao A
    let s = reduceEvents(setup);
    const initialServer = s.server;
    expect(initialServer).toBe("A");

    s = applyEvent(s, { type: "point", team: "A" });
    expect(s.server).toBe("B"); // ponto 1 → swap

    s = applyEvent(s, { type: "point", team: "A" });
    expect(s.server).toBe("B"); // ponto 2 → mantém

    s = applyEvent(s, { type: "point", team: "A" });
    expect(s.server).toBe("A"); // ponto 3 → swap

    s = applyEvent(s, { type: "point", team: "A" });
    expect(s.server).toBe("A"); // ponto 4 → mantém
  });
});

describe("scoring engine — once finished, ignores further points", () => {
  it("does not advance after match finished", () => {
    const finished = reduceEvents(pointA(48));
    expect(finished.isFinished).toBe(true);

    const after = applyEvent(finished, { type: "point", team: "B" });
    expect(after).toEqual(finished);
  });
});

describe("scoring engine — manual override", () => {
  it("applies manual state patch", () => {
    let s = initialState();
    s = applyEvent(s, {
      type: "manual",
      payload: { setsA: 1, gamesA: 3, pointsA: "30" },
    });
    expect(s.setsA).toBe(1);
    expect(s.gamesA).toBe(3);
    expect(s.pointsA).toBe("30");
  });
});

describe("scoring engine — reduceEvents reconstructs full game", () => {
  it("replays a full deuce-rich game deterministically", () => {
    const events: MatchEvent[] = [
      ...pointA(3),
      ...pointB(3),
      { type: "point", team: "A" }, // AD-40
      { type: "point", team: "B" }, // 40-40
      { type: "point", team: "A" }, // AD-40
      { type: "point", team: "A" }, // game A
    ];
    const s1 = reduceEvents(events, ADVANTAGES_CONFIG);
    const s2 = reduceEvents(events, ADVANTAGES_CONFIG);
    expect(s1).toEqual(s2);
    expect(s1.gamesA).toBe(1);
  });

  it("undo by re-reducing without the last event yields the prior state", () => {
    const all: MatchEvent[] = [
      ...pointA(3),
      { type: "point", team: "B" },
      { type: "point", team: "A" }, // ponto extra
    ];
    const after = reduceEvents(all);
    const before = reduceEvents(all.slice(0, -1));
    expect(after).not.toEqual(before);
    expect(before.pointsA).toBe("40");
    expect(before.pointsB).toBe("15");
  });
});
