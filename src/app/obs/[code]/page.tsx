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
  // ?zoom=N  → re-rasteriza o scoreboard a N×. Default 1.5 (1102×312,
  // encaixa em qualquer viewport HD sem cortar à direita).
  // ?zoom=2 = 1470×416 — recomendado se o YoloBox renderiza a 1920+.
  // ?zoom=1 = nativo 735×208 (mini).
  const zoom = (() => {
    const n = Number(zoomRaw);
    if (!Number.isFinite(n)) return 1.5;
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
    // Ancorado no canto inferior-esquerdo (convenção broadcast de
    // padel/ténis). O `zoom` re-rasteriza com densidade correcta — NÃO
    // uses transform:scale, ficaria borrado depois do YoloBox capturar.
    // Default zoom=1.5 → 1102×312, encaixa em viewports HD sem cortar.
    <div
      style={{
        position: "fixed",
        bottom: 0,
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
        preferShortNames
      />
    </div>
  );
}
