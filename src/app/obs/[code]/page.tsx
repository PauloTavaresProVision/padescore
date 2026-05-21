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

  // Dimensões nativas do scoreboard (sincronizadas com Scoreboard.tsx)
  const baseW = 735;
  const baseH = 208;
  // BUFFER vertical extra para acomodar o drop-shadow do componente
  // (~30-40px abaixo do conteúdo) + gap-1.5 do flex-col. Sem este
  // buffer, o team B e o footer ficavam cortados ao fundo do body.
  const padX = 8;
  const padY = 40;
  const innerW = baseW + padX * 2;
  const innerH = baseH + padY * 2;
  const outerW = Math.round(innerW * zoom);
  const outerH = Math.round(innerH * zoom);

  return (
    // `transform: scale` (NÃO `zoom`) — `zoom` está a falhar no webview
    // do YoloBox e cortar verticalmente. `transform: scale` é estável
    // em todos os webviews modernos. Pequena perda de nitidez vs zoom
    // mas previsível.
    //
    // html/body apertados ao tamanho final escalado → YoloBox captura
    // apenas o scoreboard, sem rectângulo morto à volta.
    <>
      <style>{`
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: ${outerW}px !important;
          height: ${outerH}px !important;
          overflow: hidden !important;
          background: transparent !important;
        }
      `}</style>
      <div
        style={{
          width: innerW,
          height: innerH,
          background: "transparent",
          transform: `scale(${zoom})`,
          transformOrigin: "top left",
          padding: `${padY}px ${padX}px`,
          boxSizing: "border-box",
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
    </>
  );
}
