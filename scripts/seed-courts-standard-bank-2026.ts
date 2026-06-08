/**
 * Cria os 8 campos do "Standard Bank Open Padel 2026 Angola" na tabela
 * `courts`. Cada campo é nomeado pelo seu patrocinador.
 *
 * Idempotente: corre quantas vezes quiseres — só insere campos que ainda
 * não existem para o torneio (case-insensitive match no nome).
 *
 * Corre com:
 *   node --env-file=.env.local --import tsx \
 *        scripts/seed-courts-standard-bank-2026.ts
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) {
  console.error(
    "Falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY em .env.local",
  );
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

// Lista de campos pela ordem em que o organizador quer vê-los no display.
const COURT_NAMES = [
  "STANDARD BANK",
  "ALPROME",
  "DOM",
  "DELTA Q",
  "GIANT SEGUROS",
  "CASA DOS FRESCOS",
  "ATC",
  "ATLÂNTIDA",
];

async function main() {
  // 1) Encontrar o torneio "Open Padel 2026" (mais recente que matchar).
  console.log("→ A procurar o torneio Open Padel 2026...");
  const { data: tournaments, error: tErr } = await sb
    .from("tournaments")
    .select("id, name, created_at")
    .ilike("name", "%open padel%")
    .order("created_at", { ascending: false });

  if (tErr) {
    console.error("❌ Erro a procurar torneios:", tErr.message);
    process.exit(1);
  }

  if (!tournaments || tournaments.length === 0) {
    console.error(
      "❌ Nenhum torneio com 'Open Padel' no nome.\n" +
        "   Cria primeiro o torneio em /admin e depois corre este script.",
    );
    process.exit(1);
  }

  const tournament = tournaments[0];
  if (tournaments.length > 1) {
    console.log(
      `⚠ ${tournaments.length} torneios match — vou usar o mais recente:`,
    );
    tournaments.forEach((t, i) => {
      console.log(`   ${i === 0 ? "→" : " "} ${t.name} (${t.created_at})`);
    });
  }
  console.log(`✓ Torneio escolhido: ${tournament.name}`);
  console.log(`  id: ${tournament.id}`);

  // 2) Que campos já existem? (para não duplicar)
  const { data: existing } = await sb
    .from("courts")
    .select("id, name, sort_order")
    .eq("tournament_id", tournament.id);

  const existingNames = new Set(
    (existing ?? []).map((c) => c.name.toUpperCase().trim()),
  );
  const maxSort = (existing ?? []).reduce(
    (acc, c) => Math.max(acc, c.sort_order ?? 0),
    0,
  );

  console.log(
    `\n→ ${existing?.length ?? 0} campo(s) já no torneio. ` +
      `Próximo sort_order: ${maxSort + 1}`,
  );

  // 3) Inserir os que faltam, preservando a ordem da lista COURT_NAMES.
  const rowsToInsert: Array<{
    tournament_id: string;
    name: string;
    sort_order: number;
  }> = [];
  let nextSort = maxSort + 1;
  for (const name of COURT_NAMES) {
    if (existingNames.has(name.toUpperCase().trim())) {
      console.log(`  ✓ "${name}" já existe — skip`);
      continue;
    }
    rowsToInsert.push({
      tournament_id: tournament.id,
      name,
      sort_order: nextSort++,
    });
  }

  if (rowsToInsert.length === 0) {
    console.log("\n✅ Nada para fazer — todos os campos já existem.");
    return;
  }

  console.log(`\n→ A inserir ${rowsToInsert.length} campo(s)...`);
  const { data: inserted, error: insertErr } = await sb
    .from("courts")
    .insert(rowsToInsert)
    .select("id, name, sort_order");

  if (insertErr) {
    console.error("❌ Erro a inserir:", insertErr.message);
    process.exit(1);
  }

  console.table(
    (inserted ?? []).map((c) => ({
      name: c.name,
      sort_order: c.sort_order,
      id: c.id.slice(0, 8) + "...",
    })),
  );
  console.log(`\n✅ Criados ${inserted?.length ?? 0} campo(s) com sucesso.`);
}

main().catch((e) => {
  console.error("❌ Erro inesperado:", e);
  process.exit(1);
});
