/**
 * Smoke test do client PadelTeams contra a API real.
 *
 *   PADELTEAMS_BEARER_TOKEN=... npx tsx scripts/test-padelteams-client.ts
 *
 *   (ou tem o token em .env.local: npx tsx --env-file=.env.local …)
 */
import {
  getCompetitionSnapshot,
  combineGameDateTime,
  fixMojibake,
} from "../src/lib/padelteams/client";

async function main() {
  console.log("→ Snapshot da competição 'ywihky' (PAYPAY OPEN)...");
  const t0 = Date.now();
  const snap = await getCompetitionSnapshot("ywihky");
  const tFresh = Date.now() - t0;
  console.log(`  ✓ ${snap.games.length} jogos, ${snap.tournaments.length} tournaments — ${tFresh}ms (fresh)`);

  // Segunda chamada — deve vir do cache
  const t1 = Date.now();
  await getCompetitionSnapshot("ywihky");
  const tCached = Date.now() - t1;
  console.log(`  ✓ segunda chamada: ${tCached}ms (cached)`);

  console.log("\n→ Mojibake fix:");
  const cases = ["AndrÃ© Silva", "José Fernandes", "Sérgio", "Ivo RÃªgo"];
  for (const c of cases) {
    console.log(`  '${c}' → '${fixMojibake(c)}'`);
  }

  console.log("\n→ Distribuição de fields:");
  const fieldsSeen = new Map<number, { name: string; description: string; count: number }>();
  for (const g of snap.games) {
    if (!g.field) continue;
    const cur = fieldsSeen.get(g.field.id);
    if (cur) cur.count++;
    else
      fieldsSeen.set(g.field.id, {
        name: g.field.name,
        description: g.field.description,
        count: 1,
      });
  }
  for (const [id, f] of [...fieldsSeen.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  • field_id=${id} name='${f.name}' (${f.description}) — ${f.count} jogos`);
  }

  console.log("\n→ Próximos 3 jogos cronologicamente:");
  const upcoming = snap.games
    .filter((g) => g.status === "open")
    .sort((a, b) => combineGameDateTime(a).getTime() - combineGameDateTime(b).getTime())
    .slice(0, 3);
  for (const g of upcoming) {
    const dt = combineGameDateTime(g);
    console.log(
      `  • ${dt.toISOString().slice(0, 16)} — ${g.field?.name ?? "?"}: ${g.team1.name} vs ${g.team2.name}`,
    );
  }

  console.log("\n→ Últimos 3 resultados:");
  const finished = snap.games
    .filter((g) => g.status === "closed" && g.results.length > 0)
    .sort((a, b) => combineGameDateTime(b).getTime() - combineGameDateTime(a).getTime())
    .slice(0, 3);
  for (const g of finished) {
    const dt = combineGameDateTime(g);
    const score = g.results.map((r) => `${r.team1}-${r.team2}`).join(" ");
    console.log(
      `  • ${dt.toISOString().slice(0, 16)} — ${g.team1.name} vs ${g.team2.name}  [${score}]`,
    );
  }

  console.log("\n✅ Client OK.");
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
