import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  Scoreboard,
  SCOREBOARD_BASE_W,
  SCOREBOARD_BASE_H,
} from "@/components/Scoreboard";
import { resolveStartedAt } from "@/lib/scoring/started-at";
import { configFromMatch } from "@/lib/scoring/apply";

export const dynamic = "force-dynamic";

export default async function ObsOverlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ scale?: string }>;
}) {
  const { code } = await params;
  const { scale: scaleRaw } = await searchParams;
  // ?scale=N → multiplica TODOS os pixels do scoreboard nativamente.
  //
  // REGRA DE OURO p/ qualidade: o render TEM de sair do tamanho final
  // que terá na transmissão. Qualquer downscale (no YoloBox ou em
  // qualquer lado) destrói qualidade — esticar e encolher imagens
  // pixeliza.
  //
  // Default scale=1 → 735×208 nativo (≈38% width × 19% height de um
  // broadcast 1920×1080). Configura o YoloBox com Scale slider a 100%
  // (sem mexer) — captura exactamente esses 735×208 e renderiza-os 1:1
  // no broadcast. Resultado: nitidez nativa.
  //
  // Se quiseres maior na transmissão, NÃO uses Scale no YoloBox —
  // muda o ?scale=N do URL para algo maior (ex: ?scale=1.5 = 1102×312)
  // e mantém o YoloBox a 100%.
  const scale = (() => {
    const n = Number(scaleRaw);
    if (!Number.isFinite(n)) return 1;
    return Math.min(5, Math.max(0.5, n));
  })();
  const w = Math.round(SCOREBOARD_BASE_W * scale);
  const h = Math.round(SCOREBOARD_BASE_H * scale);
  const supabase = createAdminClient();
  // `serverNow` é capturado no início do request para o tempo decorrido
  // ser calculado server-side (sem precisar de JS no client).
  const serverNow = Date.now();

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

  // Calcula elapsed seconds NO SERVIDOR a cada request — para o YoloBox
  // (sem JS) ver o tempo. Cada meta-refresh dispara um novo request e
  // este valor é recalculado.
  const initialElapsedSeconds = match.started_at
    ? Math.max(
        0,
        Math.floor(
          ((match.finished_at ? new Date(match.finished_at).getTime() : serverNow) -
            new Date(match.started_at).getTime()) /
            1000,
        ),
      )
    : null;

  return (
    // O scoreboard renderiza em PIXELS REAIS escalados (não CSS scale/zoom).
    // Com scale=2.6 sai naturalmente em ~1911×541 — o YoloBox capta nessa
    // resolução, fica nítido, sem transformações nem ambiguidades.
    <>
      <style>{`
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: ${w}px !important;
          height: ${h}px !important;
          overflow: hidden !important;
          background: transparent !important;
        }
      `}</style>
      {/* sb-mount: o script no layout substitui este innerHTML a cada 1s
          com o HTML novo vindo de uma nova requisição à mesma URL. */}
      <div id="sb-mount">
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
          scale={scale}
          initialElapsedSeconds={initialElapsedSeconds}
          live={false}
        />
      </div>
    </>
  );
}
