import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { TVScoreboard } from "@/components/TVScoreboard";
import { TVScoreboardStrip } from "@/components/TVScoreboardStrip";
import { FullscreenButton } from "@/components/FullscreenButton";
import { resolveStartedAt } from "@/lib/scoring/started-at";
import { configFromMatch } from "@/lib/scoring/apply";

export const dynamic = "force-dynamic";

export default async function TvPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ celebrate?: string; standby?: string; layout?: string }>;
}) {
  const { code } = await params;
  const sp = await searchParams;
  const forceWinner: "A" | "B" | null =
    sp.celebrate === "A" ? "A" : sp.celebrate === "B" ? "B" : null;
  const forceStandby = sp.standby === "1";
  const supabase = createAdminClient();

  const { data: match } = await supabase
    .from("matches")
    .select(
      "id, tournament_id, court_name, category, team_a_player1, team_a_player2, team_b_player1, team_b_player2, team_a_photo_url, team_b_photo_url, status, started_at, finished_at, golden_point, sets_to_win, games_per_set, tiebreak_at, tiebreak_points, final_set_super_tiebreak",
    )
    .eq("short_code", code.toLowerCase())
    .single();
  if (!match) notFound();

  const serverNow = Date.now();
  match.started_at = await resolveStartedAt(supabase, match.id, match.started_at);

  // Tempo decorrido calculado no SERVIDOR — para o relógio aparecer já no
  // HTML inicial sem depender do JS do cliente.
  const initialElapsedSeconds = match.started_at
    ? Math.max(
        0,
        Math.floor(
          ((match.finished_at
            ? new Date(match.finished_at).getTime()
            : serverNow) -
            new Date(match.started_at).getTime()) /
            1000,
        ),
      )
    : null;

  const [{ data: tournament }, { data: state }] = await Promise.all([
    supabase
      .from("tournaments")
      .select("*")
      .eq("id", match.tournament_id)
      .single(),
    supabase.from("match_state").select("*").eq("match_id", match.id).single(),
  ]);
  if (!tournament) notFound();

  // Layout: setting do torneio, com override ?layout=strip|classic p/ preview
  const layout =
    sp.layout === "strip" || sp.layout === "classic"
      ? sp.layout
      : ((tournament as { tv_layout?: string }).tv_layout ?? "classic");
  const Board = layout === "strip" ? TVScoreboardStrip : TVScoreboard;

  return (
    <>
      <Board
        match={match}
        tournament={tournament}
        config={configFromMatch(match)}
        forceWinner={forceWinner}
        forceStandby={forceStandby}
        initialElapsedSeconds={initialElapsedSeconds}
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
      />
      <FullscreenButton />
    </>
  );
}
