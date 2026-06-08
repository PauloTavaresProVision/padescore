/**
 * Importa o CSV de jogadores do Standard Bank Open Padel 2026.
 *
 * Lê C:/Users/ptavares/Downloads/players.csv (formato Standard Bank com 12
 * colunas) e popula a tabela players_contacts via supabase admin client.
 *
 * Uso: pnpm tsx scripts/import-standard-bank-contacts.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) {
  console.error(
    "Falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY em .env.local",
  );
  process.exit(1);
}

const TOURNAMENT_ID = "eacd0cfe-787b-444a-b8e6-3695529bb97a"; // STANDARD BANK
const CSV_PATH = "C:/Users/ptavares/Downloads/players.csv";

const CATEGORY_HEADERS = ["F1", "F2", "F3", "M1", "M2", "M3", "M4"];

function normalizePhone(raw: string, defaultCountry = "244"): string | null {
  if (!raw) return null;
  if (/[Ee]\+?\d/.test(raw) && /\d\.\d/.test(raw)) return null;
  let s = raw.replace(/[^\d+]/g, "");
  if (!s) return null;
  if (s.startsWith("+")) return s.length >= 10 ? s : null;
  if (s.startsWith("00")) {
    s = "+" + s.slice(2);
    return s.length >= 10 ? s : null;
  }
  if (s.length === 9) return `+${defaultCountry}${s}`;
  if (s.length === 12 && s.startsWith(defaultCountry)) return `+${s}`;
  if (s.length === 11 && s.startsWith("351")) return `+${s}`;
  return s.length >= 10 ? `+${s}` : null;
}

interface ParsedRow {
  name: string;
  phone: string;
  email: string | null;
  gender: "M" | "F" | null;
  category: string | null;
}

function parseCsv(text: string): {
  rows: ParsedRow[];
  errors: { line: number; reason: string; raw: string }[];
} {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { rows: [], errors: [] };

  const sep = lines[0]!.includes(";") ? ";" : lines[0]!.includes("\t") ? "\t" : ",";
  const header = lines[0]!.split(sep).map((c) => c.trim());
  const headerLower = header.map((h) => h.toLowerCase());

  const idx = {
    name: headerLower.indexOf("name"),
    gender: headerLower.indexOf("gender"),
    phone: headerLower.indexOf("phone"),
    email: headerLower.indexOf("email"),
  };
  const catIdx: Record<string, number> = {};
  for (const c of CATEGORY_HEADERS) catIdx[c] = header.indexOf(c);

  const rows: ParsedRow[] = [];
  const errors: { line: number; reason: string; raw: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    const cols = line.split(sep).map((c) => c.trim());
    const name = cols[idx.name]?.trim();
    const phoneRaw = cols[idx.phone] ?? "";
    if (!name) {
      errors.push({ line: i + 1, reason: "nome vazio", raw: line });
      continue;
    }
    const phone = normalizePhone(phoneRaw);
    if (!phone) {
      errors.push({
        line: i + 1,
        reason: `telemóvel inválido: "${phoneRaw}"`,
        raw: line,
      });
      continue;
    }
    const email = cols[idx.email]?.trim() || null;
    const gVal = cols[idx.gender]?.trim().toUpperCase();
    const gender = gVal === "M" || gVal === "F" ? gVal : null;
    let category: string | null = null;
    for (const c of CATEGORY_HEADERS) {
      const i2 = catIdx[c];
      if (i2 >= 0 && cols[i2]?.trim().toLowerCase() === "aceite") {
        category = c;
        break;
      }
    }
    rows.push({ name, phone, email, gender, category });
  }
  return { rows, errors };
}

async function main() {
  console.log(`\n📂 A ler ${CSV_PATH}...`);
  const csv = readFileSync(CSV_PATH, "utf-8");

  console.log(`📊 A parsear...`);
  const { rows, errors } = parseCsv(csv);
  console.log(`   ✓ ${rows.length} linhas válidas`);
  if (errors.length > 0) {
    console.log(`   ⚠ ${errors.length} linhas ignoradas:`);
    for (const e of errors.slice(0, 10)) {
      console.log(`     · L${e.line}: ${e.reason}`);
    }
    if (errors.length > 10) console.log(`     · ... e mais ${errors.length - 10}`);
  }

  // Stats por categoria
  const byCategory: Record<string, number> = {};
  for (const r of rows) {
    const k = r.category ?? "(sem categoria)";
    byCategory[k] = (byCategory[k] ?? 0) + 1;
  }
  console.log(`\n📋 Por categoria:`);
  for (const [k, v] of Object.entries(byCategory).sort()) {
    console.log(`   ${k}: ${v}`);
  }

  console.log(`\n💾 A upsert na DB (tournament_id=${TOURNAMENT_ID})...`);
  const supabase = createClient(url, key);

  // Apaga primeiro (mais rápido que upsert batch quando há shared phones)
  await supabase
    .from("players_contacts")
    .delete()
    .eq("tournament_id", TOURNAMENT_ID);

  // Insert em batches de 50 para evitar payload grande / timeouts
  const BATCH_SIZE = 50;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("players_contacts").insert(
      batch.map((r) => ({
        tournament_id: TOURNAMENT_ID,
        name: r.name,
        phone: r.phone,
        email: r.email,
        gender: r.gender,
        category: r.category,
      })),
    );
    if (error) {
      console.error(`\n❌ Erro ao guardar batch ${i}:`, error.message);
      process.exit(1);
    }
    process.stdout.write(`   ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}\r`);
  }
  process.stdout.write("\n");

  // Confirmar contagem na DB
  const { count } = await supabase
    .from("players_contacts")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", TOURNAMENT_ID);

  console.log(`\n✅ Importado com sucesso!`);
  console.log(`   Total em DB para este torneio: ${count ?? "?"} contactos`);
  console.log(
    `\n   Vê em: /admin/tournaments/${TOURNAMENT_ID}/contacts`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
