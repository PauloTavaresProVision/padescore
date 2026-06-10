/**
 * Apaga os torneios de teste, mantém só o Standard Bank Open Padel.
 *
 * IDs:
 *   - eacd0cfe-787b-444a-b8e6-3695529bb97a → STANDARD BANK OPEN PADEL  (manter)
 *   - ac473ee0-922d-4696-9078-3faa50b1f9d2 → PAYPAY (teste)             (apagar)
 *   - bc9c4441-13f8-418f-b6a9-2983e8d3e41e → Paulo Tavares              (apagar)
 *
 * As foreign keys têm ON DELETE CASCADE, então apagar a row tournament
 * arrasta automaticamente: courts, matches, totems, sponsors, players_contacts,
 * match_reschedule_requests (e via cascade as acceptances).
 *
 * Uso: pnpm tsx scripts/delete-test-tournaments.ts
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local");
  process.exit(1);
}

const KEEP_ID = "eacd0cfe-787b-444a-b8e6-3695529bb97a"; // STANDARD BANK

async function main() {
  const supabase = createClient(url, key);

  // 1. Listar todos os torneios
  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("id, name");

  console.log("Torneios encontrados:");
  for (const t of tournaments ?? []) {
    const flag = t.id === KEEP_ID ? "✓ MANTÉM" : "✗ APAGAR";
    console.log(`  ${flag}  ${t.name}  (${t.id})`);
  }
  console.log();

  const toDelete = (tournaments ?? []).filter((t) => t.id !== KEEP_ID);
  if (toDelete.length === 0) {
    console.log("Nada para apagar.");
    return;
  }

  // 2. Para cada um, mostrar contagens do que vai ser arrastado em cascade
  for (const t of toDelete) {
    console.log(`A apagar "${t.name}"...`);

    // Quantas rows relacionadas?
    const counts = await Promise.all([
      supabase.from("courts").select("id", { count: "exact", head: true }).eq("tournament_id", t.id),
      supabase.from("matches").select("id", { count: "exact", head: true }).eq("tournament_id", t.id),
      supabase.from("totems").select("id", { count: "exact", head: true }).eq("tournament_id", t.id),
      supabase.from("tournament_sponsors").select("id", { count: "exact", head: true }).eq("tournament_id", t.id),
    ]);
    console.log(
      `   relacionados: ${counts[0].count ?? 0} courts, ${counts[1].count ?? 0} matches, ${counts[2].count ?? 0} cavaletes, ${counts[3].count ?? 0} sponsors`,
    );

    const { error } = await supabase.from("tournaments").delete().eq("id", t.id);
    if (error) {
      console.error(`   ❌ falha: ${error.message}`);
      process.exit(1);
    }
    console.log(`   ✓ apagado`);
  }

  console.log("\n✅ Concluído. Standard Bank Open Padel é agora o único torneio.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
