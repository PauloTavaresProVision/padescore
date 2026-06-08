/**
 * Verifica que a migration 0015_padelteams_integration.sql foi aplicada.
 *
 *   npx tsx --env-file=.env.local scripts/verify-padelteams-migration.ts
 */
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function main() {
  let errors = 0;

  // 1) tournaments.padelteams_competition_code
  console.log("→ tournaments.padelteams_competition_code");
  const { error: tErr } = await sb
    .from("tournaments")
    .select("id, padelteams_competition_code")
    .limit(1);
  if (tErr) {
    console.error("  ❌", tErr.message);
    errors++;
  } else {
    console.log("  ✓ existe");
  }

  // 2) courts.padelteams_field_id
  console.log("→ courts.padelteams_field_id");
  const { error: cErr } = await sb
    .from("courts")
    .select("id, padelteams_field_id")
    .limit(1);
  if (cErr) {
    console.error("  ❌", cErr.message);
    errors++;
  } else {
    console.log("  ✓ existe");
  }

  // 3) players.padelteams_player_id
  console.log("→ players.padelteams_player_id");
  const { error: pErr } = await sb
    .from("players")
    .select("id, padelteams_player_id")
    .limit(1);
  if (pErr) {
    console.error("  ❌", pErr.message);
    errors++;
  } else {
    console.log("  ✓ existe");
  }

  // 4) totems.court_id_2
  console.log("→ totems.court_id_2");
  const { error: t2Err } = await sb
    .from("totems")
    .select("id, court_id, court_id_2")
    .limit(1);
  if (t2Err) {
    console.error("  ❌", t2Err.message);
    errors++;
  } else {
    console.log("  ✓ existe");
  }

  // 5) padelteams_game_overrides
  console.log("→ padelteams_game_overrides (tabela)");
  const { error: oErr } = await sb
    .from("padelteams_game_overrides")
    .select("*")
    .limit(1);
  if (oErr) {
    console.error("  ❌", oErr.message);
    errors++;
  } else {
    console.log("  ✓ existe");
  }

  // 6) Sanidade: estado actual da DB
  console.log("\n→ Estado actual:");
  const { data: tournaments } = await sb
    .from("tournaments")
    .select("id, name, padelteams_competition_code");
  for (const t of tournaments ?? []) {
    console.log(
      `  • ${t.name}: code = ${t.padelteams_competition_code ?? "(não configurado)"}`,
    );
  }

  const { data: courts } = await sb
    .from("courts")
    .select("tournament_id, name, padelteams_field_id")
    .order("sort_order");
  const courtsByTournament = new Map<
    string,
    Array<{ name: string; padelteams_field_id: number | null }>
  >();
  for (const c of courts ?? []) {
    const arr = courtsByTournament.get(c.tournament_id) ?? [];
    arr.push({ name: c.name, padelteams_field_id: c.padelteams_field_id });
    courtsByTournament.set(c.tournament_id, arr);
  }
  for (const [tid, cs] of courtsByTournament) {
    const linked = cs.filter((c) => c.padelteams_field_id).length;
    console.log(`  • ${tid.slice(0, 8)}…: ${cs.length} campos, ${linked} ligados ao PadelTeams`);
  }

  if (errors > 0) {
    console.error(`\n❌ ${errors} erro(s) — migration NÃO aplicada ou parcial.`);
    process.exit(1);
  } else {
    console.log("\n✅ Migration 0015 aplicada com sucesso.");
  }
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
