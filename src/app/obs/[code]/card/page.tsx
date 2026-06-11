import { existsSync } from "node:fs";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { IntervalCard } from "@/components/IntervalCard";
import { resolveStartedAt } from "@/lib/scoring/started-at";
import { resolveSetDurations } from "@/lib/scoring/set-durations";
import { configFromMatch } from "@/lib/scoring/apply";

// Logo do sponsor no canto inferior direito do cartão: basta colocar o
// ficheiro em public/byte-digital.png — se não existir, o slot não aparece.
const SPONSOR_FILE = "byte-digital.png";

export const dynamic = "force-dynamic";

/**
 * OBS — cartão de INTERVALO (estilo Premier Padel).
 *
 * URL: /obs/{code}/card  (Browser Source da cena de intervalo no OBS)
 *
 * Mostra categoria, nomes COMPLETOS das duplas, resultado por sets e a
 * duração do jogo. Fundo transparente. O refresh vem do polling do layout
 * /obs (troca o #sb-mount a cada 1s) — por isso a duração e os scores
 * actualizam sozinhos sem JS próprio.
 *
 * ?size=N → percentagem da largura ocupada pelo cartão (10–100, default 60).
 * ?pos=top|center|bottom → posição vertical (default center).
 * O dimensionamento é 100% CSS (vw/vh) — nunca corta, em nenhuma janela.
 */
export default async function ObsIntervalCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ bg?: string; size?: string; pos?: string }>;
}) {
  const { code } = await params;
  const { bg, size: sizeRaw, pos: posRaw } = await searchParams;
  // Fracção da largura do Browser Source que o cartão ocupa (default 60%,
  // estilo lower-third). ?size=100 → largura toda.
  const size = (() => {
    const n = Number(sizeRaw);
    if (!Number.isFinite(n)) return 0.6;
    return Math.min(100, Math.max(10, n)) / 100;
  })();
  const pos: "top" | "center" | "bottom" =
    posRaw === "top" || posRaw === "bottom" ? posRaw : "center";

  const supabase = createAdminClient();
  const serverNow = Date.now();

  const { data: match } = await supabase
    .from("matches")
    .select(
      "id, tournament_id, court_name, category, team_a_player1, team_a_player2, team_b_player1, team_b_player2, status, started_at, finished_at, golden_point, sets_to_win, games_per_set, tiebreak_at, tiebreak_points, final_set_super_tiebreak",
    )
    .eq("short_code", code.toLowerCase())
    .single();
  if (!match) notFound();

  match.started_at = await resolveStartedAt(
    supabase,
    match.id,
    match.started_at,
  );

  const [{ data: tournament }, { data: state }] = await Promise.all([
    supabase
      .from("tournaments")
      .select("id, name, logo_url, primary_color")
      .eq("id", match.tournament_id)
      .single(),
    supabase.from("match_state").select("*").eq("match_id", match.id).single(),
  ]);
  if (!tournament) notFound();

  // Duração calculada no servidor a cada request — o polling do layout
  // re-renderiza este HTML a cada 1s, por isso o relógio "anda" sozinho.
  const elapsedSeconds = match.started_at
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

  // Durações por set (estilo Premier Padel: "65' 18'") — reconstruídas do
  // log de pontos. Calculadas a cada request, por isso o set em curso anda.
  const setDurations = await resolveSetDurations(
    supabase,
    match.id,
    configFromMatch(match),
    match.started_at,
    match.finished_at,
    serverNow,
  );

  const sponsorUrl = existsSync(join(process.cwd(), "public", SPONSOR_FILE))
    ? `/${SPONSOR_FILE}`
    : null;

  // Fundo TRANSPARENTE por defeito — pronto a colar no OBS/YoloBox sem
  // parâmetros (vê-se o vídeo à volta do cartão). ?bg=dark pinta o fundo
  // escuro, útil só para pré-visualizar no browser.
  const darkPreview = bg === "dark";

  return (
    <>
      <style>{`
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          height: 100% !important;
          overflow: hidden !important;
          background: ${darkPreview ? "#101010" : "transparent"} !important;
        }
      `}</style>
      <div id="sb-mount">
        <IntervalCard
          match={match}
          tournament={tournament}
          state={
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
          elapsedSeconds={elapsedSeconds}
          setDurations={setDurations}
          sponsorUrl={sponsorUrl}
          size={size}
          pos={pos}
        />
      </div>
    </>
  );
}
