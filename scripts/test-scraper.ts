import { getPublicCompetitionGames } from "../src/lib/padelteams/scraper";

async function main() {
const snap = await getPublicCompetitionGames("rjlloc");
console.log("Competition:", snap.competitionName);
console.log("Date range:", snap.dateFrom, "→", snap.dateTo);
console.log("Total games:", snap.games.length);
console.log();
console.log("First 5 games:");
for (const g of snap.games.slice(0, 5)) {
  console.log(
    "  ·",
    g.scheduledAt,
    g.field.padEnd(20),
    g.teamA,
    "VS",
    g.teamB,
  );
}
console.log();
console.log(
  "Games on 2026-06-13:",
  snap.games.filter((g) => g.date === "2026-06-13").length,
);
console.log(
  "Games on 2026-06-14:",
  snap.games.filter((g) => g.date === "2026-06-14").length,
);

const gikaGames = snap.games.filter(
  (g) => g.teamA.includes("Gika") || g.teamB.includes("Gika"),
);
console.log();
console.log("Gika jogos:", gikaGames.length);
gikaGames.forEach((g) =>
  console.log("  ·", g.scheduledAt, g.field, g.teamA, "VS", g.teamB),
);

// Test Arlete (F1)
const arleteGames = snap.games.filter(
  (g) => g.teamA.includes("Arlete") || g.teamB.includes("Arlete"),
);
console.log();
console.log("Arlete Curval jogos:", arleteGames.length);
arleteGames.forEach((g) =>
  console.log("  ·", g.scheduledAt, g.field, g.teamA, "VS", g.teamB),
);
}
main().catch(e => { console.error(e); process.exit(1); });
