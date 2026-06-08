/**
 * Limpa a configuração PadelTeams do torneio Standard Bank Open Padel
 * (para deixar limpo enquanto o torneio não está aberto no PadelTeams).
 *
 *   npx tsx --env-file=.env.local scripts/reset-standard-bank-padelteams.ts
 */
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const TOURNAMENT_ID = "eacd0cfe-787b-444a-b8e6-3695529bb97a";

async function main() {
  // Limpa o code do torneio
  const { error: tErr } = await sb
    .from("tournaments")
    .update({ padelteams_competition_code: null })
    .eq("id", TOURNAMENT_ID);
  if (tErr) throw tErr;

  // Limpa associações de fields dos courts
  const { error: cErr, count } = await sb
    .from("courts")
    .update({ padelteams_field_id: null }, { count: "exact" })
    .eq("tournament_id", TOURNAMENT_ID)
    .not("padelteams_field_id", "is", null);
  if (cErr) throw cErr;

  console.log(`✅ Standard Bank limpo. ${count ?? 0} field associations removidas.`);
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
