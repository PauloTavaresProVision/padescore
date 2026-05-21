import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Endpoint HTTP simples para o polling do Scoreboard. Foi criado porque o
// cliente Supabase JS falha em alguns webviews (YoloBox, etc.) — provavelmente
// por falta de APIs do browser que ele requer. Aqui devolvemos JSON cru via
// route handler do Next, que qualquer webview com `fetch()` consegue ler.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();
  const [{ data: state }, { data: match }] = await Promise.all([
    supabase
      .from("match_state")
      .select("*")
      .eq("match_id", id)
      .maybeSingle(),
    supabase
      .from("matches")
      .select(
        "court_name, team_a_player1, team_a_player2, team_b_player1, team_b_player2, team_a_player1_short, team_a_player2_short, team_b_player1_short, team_b_player2_short, status, started_at, finished_at",
      )
      .eq("id", id)
      .maybeSingle(),
  ]);

  return NextResponse.json(
    { state, match },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    },
  );
}
