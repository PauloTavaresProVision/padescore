/**
 * Verifica que a migration 0012_courts_and_scheduling.sql foi aplicada.
 * Corre com:  node --env-file=.env.local --import tsx scripts/verify-courts-migration.ts
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  console.log("→ A verificar a tabela `courts`...");
  const { data: courts, error: courtsErr } = await sb
    .from("courts")
    .select("id, tournament_id, name, sort_order, created_at")
    .order("created_at", { ascending: true });
  if (courtsErr) {
    console.error("❌ courts NÃO existe ou erro:", courtsErr.message);
    process.exit(1);
  }
  console.log(`✓ tabela courts existe — ${courts.length} row(s)`);
  if (courts.length > 0) {
    console.table(
      courts.map((c) => ({
        name: c.name,
        sort: c.sort_order,
        tournament: c.tournament_id.slice(0, 8) + "...",
      })),
    );
  }

  console.log("\n→ A verificar colunas novas em `matches`...");
  const { data: matches, error: matchesErr } = await sb
    .from("matches")
    .select("id, court_name, court_id, scheduled_at, tournament_id")
    .order("created_at", { ascending: false })
    .limit(15);
  if (matchesErr) {
    console.error("❌ erro a ler matches:", matchesErr.message);
    process.exit(1);
  }

  const withCourtId = matches.filter((m) => m.court_id !== null).length;
  const withoutCourtId = matches.filter((m) => m.court_id === null).length;
  const withScheduled = matches.filter((m) => m.scheduled_at !== null).length;

  console.log(`✓ matches têm a coluna court_id e scheduled_at`);
  console.log(`  • ${withCourtId}/${matches.length} matches com court_id (backfill)`);
  console.log(`  • ${withoutCourtId}/${matches.length} matches sem court_id`);
  console.log(`  • ${withScheduled}/${matches.length} matches com scheduled_at`);

  if (matches.length > 0) {
    console.log("\nAmostra (últimos 15 matches):");
    console.table(
      matches.map((m) => ({
        id: m.id.slice(0, 8),
        court_name: m.court_name,
        court_id: m.court_id ? m.court_id.slice(0, 8) + "..." : "—",
        scheduled_at: m.scheduled_at ?? "—",
      })),
    );
  }

  // Validação cruzada: todos os court_id de matches existem em courts?
  console.log("\n→ Validação cruzada matches.court_id → courts.id...");
  const matchCourtIds = [
    ...new Set(matches.map((m) => m.court_id).filter(Boolean)),
  ] as string[];
  if (matchCourtIds.length > 0) {
    const { data: refCourts } = await sb
      .from("courts")
      .select("id")
      .in("id", matchCourtIds);
    const found = refCourts?.length ?? 0;
    if (found === matchCourtIds.length) {
      console.log(`✓ Todos os ${found} court_id usados em matches existem em courts`);
    } else {
      console.warn(`⚠ ${matchCourtIds.length - found} court_id em matches não existem em courts`);
    }
  }

  // Por tournament: quantos courts e quantos matches
  console.log("\n→ Resumo por torneio:");
  const { data: tournaments } = await sb
    .from("tournaments")
    .select("id, name");
  for (const t of tournaments ?? []) {
    const { count: courtCount } = await sb
      .from("courts")
      .select("*", { count: "exact", head: true })
      .eq("tournament_id", t.id);
    const { count: matchCount } = await sb
      .from("matches")
      .select("*", { count: "exact", head: true })
      .eq("tournament_id", t.id);
    console.log(`  • ${t.name}: ${courtCount} campo(s), ${matchCount} jogo(s)`);
  }

  console.log("\n✅ Verificação concluída.");
}

main().catch((e) => {
  console.error("❌ Erro:", e);
  process.exit(1);
});
