/**
 * Cria um torneio de TESTE "PAYPAY (teste)" totalmente configurado contra
 * a API PadelTeams (competição ywihky), com os 6 campos auto-associados.
 *
 * Idempotente: corre quantas vezes quiseres — só cria o que falta.
 *
 *   npx tsx --env-file=.env.local scripts/setup-paypay-test.ts
 */
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const STANDARD_BANK_ID = "eacd0cfe-787b-444a-b8e6-3695529bb97a";
const TEST_TOURNAMENT_NAME = "PAYPAY (teste)";
const COMPETITION_CODE = "ywihky";

// Estes nomes batem 1:1 com os field.name no PadelTeams da competição
// ywihky — assim o auto-match faz tudo sozinho.
const COURT_NAMES = [
  { name: "PAYPAY", sort: 1 },
  { name: "TCHACO", sort: 2 },
  { name: "VIVA", sort: 3 },
  { name: "AWS", sort: 4 },
  { name: "ATC", sort: 5 },
  { name: "CIN", sort: 6 },
];

// IDs dos fields do PadelTeams ywihky (descobertos via API).
// Hardcoded aqui porque é setup one-time para um torneio de teste; se
// alguma vez mudar, basta correr este script de novo (idempotente).
const PADELTEAMS_FIELD_IDS: Record<string, number> = {
  PAYPAY: 57456,
  TCHACO: 57461,
  VIVA: 57457,
  AWS: 57458,
  ATC: 57459,
  CIN: 57460,
};

async function main() {
  // 1) Owner: pegamos no owner do Standard Bank para ser o mesmo deste
  //    torneio de teste (mesma conta).
  const { data: sb1 } = await sb
    .from("tournaments")
    .select("owner_id")
    .eq("id", STANDARD_BANK_ID)
    .single();
  if (!sb1?.owner_id) {
    throw new Error("Não consegui descobrir owner_id do Standard Bank.");
  }
  const ownerId = sb1.owner_id;
  console.log(`✓ Owner identificado: ${ownerId.slice(0, 8)}…`);

  // 2) Criar (ou encontrar) o torneio de teste
  let { data: testTourney } = await sb
    .from("tournaments")
    .select("id, padelteams_competition_code")
    .eq("name", TEST_TOURNAMENT_NAME)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!testTourney) {
    const { data: created, error } = await sb
      .from("tournaments")
      .insert({
        name: TEST_TOURNAMENT_NAME,
        owner_id: ownerId,
        padelteams_competition_code: COMPETITION_CODE,
      })
      .select("id, padelteams_competition_code")
      .single();
    if (error) throw error;
    testTourney = created;
    console.log(`✓ Torneio "${TEST_TOURNAMENT_NAME}" criado: ${testTourney.id}`);
  } else {
    if (testTourney.padelteams_competition_code !== COMPETITION_CODE) {
      await sb
        .from("tournaments")
        .update({ padelteams_competition_code: COMPETITION_CODE })
        .eq("id", testTourney.id);
      console.log(`✓ Code actualizado para "${COMPETITION_CODE}"`);
    }
    console.log(`✓ Torneio "${TEST_TOURNAMENT_NAME}" já existia: ${testTourney.id}`);
  }

  const tournamentId = testTourney.id;

  // 3) Criar campos em falta (idempotente por nome)
  const { data: existingCourts } = await sb
    .from("courts")
    .select("id, name, padelteams_field_id, sort_order")
    .eq("tournament_id", tournamentId);

  const existingByName = new Map(
    (existingCourts ?? []).map((c) => [c.name.toUpperCase(), c]),
  );

  let created = 0;
  let updated = 0;
  for (const { name, sort } of COURT_NAMES) {
    const expectedFieldId = PADELTEAMS_FIELD_IDS[name];
    const existing = existingByName.get(name.toUpperCase());

    if (!existing) {
      const { error } = await sb.from("courts").insert({
        tournament_id: tournamentId,
        name,
        sort_order: sort,
        padelteams_field_id: expectedFieldId,
      });
      if (error) throw error;
      console.log(`  ✓ ${name} criado (field_id=${expectedFieldId})`);
      created++;
    } else if (existing.padelteams_field_id !== expectedFieldId) {
      await sb
        .from("courts")
        .update({ padelteams_field_id: expectedFieldId })
        .eq("id", existing.id);
      console.log(`  ✓ ${name} actualizado (field_id=${expectedFieldId})`);
      updated++;
    } else {
      console.log(`  • ${name} já OK`);
    }
  }

  console.log(`\n✅ Setup completo.`);
  console.log(`   Torneio ID: ${tournamentId}`);
  console.log(`   ${created} campo(s) criados, ${updated} actualizados`);
  console.log(`\n   Próximo passo:`);
  console.log(`   http://localhost:3000/admin/tournaments/${tournamentId}/totens`);
  console.log(`   → "+ Adicionar cavalete" → escolhe 2 campos → Guarda`);
  console.log(`   → Copia o token → curl http://localhost:3000/api/cavalete/<token>`);
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
