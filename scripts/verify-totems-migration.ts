/**
 * Verifica que a migration 0013_totems_and_sponsors.sql foi aplicada.
 * Corre com:  npx tsx --env-file=.env.local scripts/verify-totems-migration.ts
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  console.log("→ Tabela `totems`...");
  const { error: tErr, count: tCount } = await sb
    .from("totems")
    .select("*", { count: "exact", head: true });
  if (tErr) {
    console.error("❌", tErr.message);
    process.exit(1);
  }
  console.log(`✓ totems existe — ${tCount ?? 0} row(s)`);

  console.log("\n→ Tabela `tournament_sponsors`...");
  const { error: sErr, count: sCount } = await sb
    .from("tournament_sponsors")
    .select("*", { count: "exact", head: true });
  if (sErr) {
    console.error("❌", sErr.message);
    process.exit(1);
  }
  console.log(`✓ tournament_sponsors existe — ${sCount ?? 0} row(s)`);

  console.log("\n→ Storage bucket `tournament-sponsors`...");
  const { data: buckets, error: bErr } = await sb.storage.listBuckets();
  if (bErr) {
    console.error("❌", bErr.message);
    process.exit(1);
  }
  const bucket = buckets.find((b) => b.id === "tournament-sponsors");
  if (!bucket) {
    console.error("❌ bucket tournament-sponsors não encontrado");
    process.exit(1);
  }
  console.log(`✓ bucket existe (public=${bucket.public})`);

  console.log("\n→ Função generate_totem_token()...");
  const { data: tok, error: fErr } = await sb.rpc("generate_totem_token");
  if (fErr) {
    console.error("❌", fErr.message);
    process.exit(1);
  }
  console.log(`✓ function devolve token (${(tok as string).length} chars): ${(tok as string).slice(0, 10)}...`);

  console.log("\n✅ Migration 0013 OK.");
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
