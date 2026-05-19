import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { OperatorClient } from "./OperatorClient";
import { configFromMatch } from "@/lib/scoring/apply";

export const dynamic = "force-dynamic";

export default async function OperatorPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  // Aceita tanto o código curto novo (8 chars) como o token longo (32 hex)
  // existente — backwards-compat com matches antigos.
  const lookupColumn = token.length === 8 ? "operator_short_code" : "operator_token";

  const { data: match } = await supabase
    .from("matches")
    .select(
      "id, court_name, team_a_player1, team_a_player2, team_b_player1, team_b_player2, golden_point, sets_to_win, games_per_set, tiebreak_at, tiebreak_points, final_set_super_tiebreak",
    )
    .eq(lookupColumn, token.toLowerCase())
    .single();

  if (!match) notFound();

  const { data: state } = await supabase
    .from("match_state")
    .select("*")
    .eq("match_id", match.id)
    .single();

  const teamA = [match.team_a_player1, match.team_a_player2].filter(Boolean).join(" / ");
  const teamB = [match.team_b_player1, match.team_b_player2].filter(Boolean).join(" / ");
  const config = configFromMatch(match);

  return (
    <OperatorClient
      token={token}
      matchId={match.id}
      teamA={teamA}
      teamB={teamB}
      court={match.court_name}
      config={config}
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
        }
      }
    />
  );
}
