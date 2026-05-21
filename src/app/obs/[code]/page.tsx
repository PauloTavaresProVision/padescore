import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { Scoreboard } from "@/components/Scoreboard";
import { resolveStartedAt } from "@/lib/scoring/started-at";
import { configFromMatch } from "@/lib/scoring/apply";

export const dynamic = "force-dynamic";

export default async function ObsOverlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ zoom?: string }>;
}) {
  const { code } = await params;
  const { zoom: zoomRaw } = await searchParams;
  // ?zoom=N  → re-rasteriza o scoreboard a N×. Default 2 (recomendado p/
  // YoloBox / OBS Browser Source). 1 = tamanho nativo, 3 = jumbo.
  const zoom = (() => {
    const n = Number(zoomRaw);
    if (!Number.isFinite(n)) return 2;
    return Math.min(4, Math.max(0.5, n));
  })();
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
    // Renderiza no canto superior-esquerdo. O `zoom` re-rasteriza com
    // densidade correcta (NÃO uses transform:scale aqui — ficaria borrado
    // depois do YoloBox/OBS capturarem). Tamanho nativo é 735×208; com
    // zoom=2 (default) ocupa 1470×416, suficientemente grande para o
    // YoloBox capturar e re-escalar sem perda. Para mais pequeno usa
    // `?zoom=1`, para jumbo `?zoom=3`.
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        background: "transparent",
        zoom,
      }}
    >
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
