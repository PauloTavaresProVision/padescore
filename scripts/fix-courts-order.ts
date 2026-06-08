/**
 * Corrige a ordem dos campos do "Standard Bank Open Padel 2026" para a
 * ordem solicitada pelo organizador.
 */
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const TOURNAMENT_ID = "eacd0cfe-787b-444a-b8e6-3695529bb97a";

const DESIRED_ORDER = [
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
  const { data: courts, error } = await sb
    .from("courts")
    .select("id, name, sort_order")
    .eq("tournament_id", TOURNAMENT_ID);

  if (error) throw error;

  console.log("Estado actual:");
  console.table(
    [...(courts ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => ({ sort: c.sort_order, name: c.name })),
  );

  console.log("\nA actualizar para a ordem pretendida...");
  for (let i = 0; i < DESIRED_ORDER.length; i++) {
    const targetName = DESIRED_ORDER[i];
    const court = courts?.find(
      (c) => c.name.trim().toUpperCase() === targetName.toUpperCase(),
    );
    if (!court) {
      console.log(`  ⚠ "${targetName}" não encontrado — skip`);
      continue;
    }
    if (court.sort_order === i + 1) {
      console.log(`  • "${targetName}" já está em #${i + 1} — skip`);
      continue;
    }
    const { error: updErr } = await sb
      .from("courts")
      .update({ sort_order: i + 1 })
      .eq("id", court.id);
    if (updErr) {
      console.error(`  ❌ "${targetName}":`, updErr.message);
    } else {
      console.log(`  ✓ "${targetName}": ${court.sort_order} → ${i + 1}`);
    }
  }

  const { data: after } = await sb
    .from("courts")
    .select("name, sort_order")
    .eq("tournament_id", TOURNAMENT_ID)
    .order("sort_order");

  console.log("\nEstado final:");
  console.table(
    (after ?? []).map((c) => ({ sort: c.sort_order, name: c.name })),
  );
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
