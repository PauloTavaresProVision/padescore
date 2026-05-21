import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { Scoreboard } from "@/components/Scoreboard";
import { resolveStartedAt } from "@/lib/scoring/started-at";
import { configFromMatch } from "@/lib/scoring/apply";

export const dynamic = "force-dynamic";

export default async function ObsOverlayPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = createAdminClient();

  const { data: matchRaw } = await supabase
    .from("matches")
    .select(
      "id, tournament_id, court_name, team_a_player1, team_a_player2, team_b_player1, team_b_player2, team_a_player1_short, team_a_player2_short, team_b_player1_short, team_b_player2_short, status, started_at, finished_at, golden_point, sets_to_win, games_per_set, tiebreak_at, tiebreak_points, final_set_super_tiebreak",
    )
    .eq("short_code", code.toLowerCase())
    .single();
  if (!matchRaw) notFound();

  // OBS usa sempre nomes CURTOS (fallback ao longo se não houver).
  const match = {
    ...matchRaw,
    team_a_player1: matchRaw.team_a_player1_short ?? matchRaw.team_a_player1,
    team_a_player2: matchRaw.team_a_player2_short ?? matchRaw.team_a_player2,
    team_b_player1: matchRaw.team_b_player1_short ?? matchRaw.team_b_player1,
    team_b_player2: matchRaw.team_b_player2_short ?? matchRaw.team_b_player2,
  };

  match.started_at = await resolveStartedAt(supabase, match.id, match.started_at);

  const [{ data: tournament }, { data: state }] = await Promise.all([
    supabase
      .from("tournaments")
      .select("id, name, logo_url, primary_color")
      .eq("id", match.tournament_id)
      .single(),
    supabase.from("match_state").select("*").eq("match_id", match.id).single(),
  ]);
  if (!tournament) notFound();

  return (
    // Sem padding, sem scale, sem flex — o scoreboard renderiza no canto
    // superior-esquerdo, no seu tamanho nativo. O OBS Browser Source / YoloBox
    // deve usar Largura=735 Altura=208 para um fit perfeito (depois escalam à
    // vontade na cena, sem perda de definição).
    <div style={{ position: "fixed", top: 0, left: 0, background: "transparent" }}>
      <Scoreboard
        match={match}
        tournament={tournament}
        config={configFromMatch(match)}
        initialState={
          state ?? {
            points_a: "0",
            points_b: "0",
            games_a: 0,
            games_b: 0,
            sets_a: 0,
            sets_b: 0,
            sets_history: [],
            server: "A",
            in_tiebreak: false,
            in_super_tiebreak: false,
            is_finished: false,
            winner: null,
          }
        }
        variant="overlay"
      />
    </div>
  );
}
