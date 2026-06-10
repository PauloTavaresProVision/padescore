/**
 * Cria os 4 cavaletes para o Standard Bank Open Padel 2026.
 * Cada cavalete agrupa 2 courts adjacentes — assume-se que os kiosks
 * vão ser colocados entre cada par.
 *
 * Pares sugeridos:
 *   CV1: STANDARD BANK + ALPROME       (courts 1+2)
 *   CV2: DOM + DELTA Q                  (courts 3+4)
 *   CV3: GIANT SEGUROS + CASA DOS FRESCOS  (courts 5+6)
 *   CV4: ATC + ATLÂNTIDA                (courts 7+8)
 *
 * Uso: pnpm tsx scripts/create-standard-bank-cavaletes.ts
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local");
  process.exit(1);
}

const TOURNAMENT_ID = "eacd0cfe-787b-444a-b8e6-3695529bb97a";

const PAIRS: { name: string; court1: string; court2: string }[] = [
  { name: "CV1 (STANDARD BANK + ALPROME)", court1: "STANDARD BANK", court2: "ALPROME" },
  { name: "CV2 (DOM + DELTA Q)", court1: "DOM", court2: "DELTA Q" },
  { name: "CV3 (GIANT + CASA DOS FRESCOS)", court1: "GIANT SEGUROS", court2: "CASA DOS FRESCOS" },
  { name: "CV4 (ATC + ATLÂNTIDA)", court1: "ATC", court2: "ATLÂNTIDA" },
];

async function main() {
  const supabase = createClient(url, key);

  // 1. Buscar courts do torneio
  const { data: courtsRaw } = await supabase
    .from("courts")
    .select("id, name")
    .eq("tournament_id", TOURNAMENT_ID);
  const courts = courtsRaw ?? [];

  const byName = new Map<string, string>();
  for (const c of courts) {
    byName.set(c.name.trim().toUpperCase(), c.id);
  }

  console.log(`Courts encontrados: ${courts.length}`);
  for (const c of courts) console.log(`  · ${c.name}  (${c.id.slice(0, 8)}...)`);
  console.log();

  // 2. Apagar cavaletes antigos (recriar limpos)
  const { data: existing } = await supabase
    .from("totems")
    .select("id, name")
    .eq("tournament_id", TOURNAMENT_ID);
  if (existing && existing.length > 0) {
    console.log(`A apagar ${existing.length} cavalete(s) antigo(s):`);
    for (const t of existing) console.log(`  · ${t.name}`);
    const { error } = await supabase
      .from("totems")
      .delete()
      .eq("tournament_id", TOURNAMENT_ID);
    if (error) {
      console.error("❌ Falha a apagar:", error.message);
      process.exit(1);
    }
    console.log();
  }

  // 3. Criar os 4 cavaletes
  console.log("A criar cavaletes...");
  const rows: Array<{
    tournament_id: string;
    name: string;
    court_id: string;
    court_id_2: string;
  }> = [];

  for (const p of PAIRS) {
    const c1 = byName.get(p.court1.toUpperCase());
    const c2 = byName.get(p.court2.toUpperCase());
    if (!c1) {
      console.error(`❌ Court não encontrado: "${p.court1}"`);
      process.exit(1);
    }
    if (!c2) {
      console.error(`❌ Court não encontrado: "${p.court2}"`);
      process.exit(1);
    }
    rows.push({
      tournament_id: TOURNAMENT_ID,
      name: p.name,
      court_id: c1,
      court_id_2: c2,
    });
  }

  // Insert um a um para que a função default de api_token corra por linha
  // (gera token único por totem)
  for (const r of rows) {
    const { data, error } = await supabase
      .from("totems")
      .insert(r)
      .select("id, name, api_token")
      .single();
    if (error || !data) {
      console.error(`❌ Falha a criar "${r.name}":`, error?.message);
      process.exit(1);
    }
    console.log(`  ✓ ${data.name}`);
    console.log(`      token: ${data.api_token}`);
    console.log(`      URL:   /cavalete/${data.api_token}`);
  }

  console.log("\n✅ 4 cavaletes criados.");
  console.log(`\nVai a /admin/tournaments/${TOURNAMENT_ID}/totens para ver/gerir.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
