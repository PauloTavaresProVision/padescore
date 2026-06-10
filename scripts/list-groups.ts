/**
 * Lista os grupos de cada categoria (F1-F3, M1-M4) do Standard Padel Open.
 *
 * Uso:
 *   pnpm tsx scripts/list-groups.ts
 */

const TOKEN = process.env.PADELTEAMS_BEARER_TOKEN!;
if (!TOKEN) {
  console.error("Falta PADELTEAMS_BEARER_TOKEN no .env.local");
  process.exit(1);
}

const cats: { id: number; name: string }[] = [
  { id: 30125, name: "F1" },
  { id: 30127, name: "F2" },
  { id: 30129, name: "F3" },
  { id: 30126, name: "M1" },
  { id: 30128, name: "M2" },
  { id: 30130, name: "M3" },
  { id: 30132, name: "M4" },
];

interface PhaseGroup {
  id: number;
  name: string;
  status: string;
  teams?: string;
}
interface Phase {
  id: number;
  name: string;
  schema_type: string;
  groups: PhaseGroup[];
}
interface TournamentView {
  tournament: { id: number; name: string; players_gender: string };
  phases: Phase[];
}

async function main() {
  for (const cat of cats) {
    const res = await fetch(
      `https://protected.padelteams.pt/v1/tournament/view?id=${cat.id}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } },
    );
    if (!res.ok) {
      console.log(`\n===== ${cat.name} (id=${cat.id}) ===== ERR HTTP ${res.status}`);
      continue;
    }
    const data = (await res.json()) as TournamentView;
    console.log(`\n===== ${cat.name} (tournament_id=${cat.id}) =====`);
    for (const phase of data.phases) {
      console.log(
        `  ${phase.name.padEnd(15)}  ${phase.groups.length} grupo${phase.groups.length === 1 ? "" : "s"}`,
      );
      for (const g of phase.groups) {
        console.log(
          `    · ${g.name.padEnd(12)} id=${String(g.id).padEnd(7)} status=${g.status}`,
        );
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
