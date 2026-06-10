import { existsSync } from "node:fs";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { IntervalCard } from "@/components/IntervalCard";
import { resolveStartedAt } from "@/lib/scoring/started-at";

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
 * O dimensionamento é 100% CSS (vw/vh) — nunca corta, em nenhuma janela.
 */
export default async function ObsIntervalCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ scale?: string; bg?: string; size?: string }>;
}) {
  const { code } = await params;
  const { bg, size: sizeRaw } = await searchParams;
  // Fracção da largura do Browser Source que o cartão ocupa (default 60%,
  // estilo lower-third). ?size=100 → largura toda.
  const size = (() => {
    const n = Number(sizeRaw);
    if (!Number.isFinite(n)) return 0.6;
    return Math.min(100, Math.max(10, n)) / 100;
  })();

  const supabase = createAdminClient();
  const serverNow = Date.now();

  const { data: match } = await supabase
    .from("matches")
    .select(
      "id, tournament_id, court_name, category, team_a_player1, team_a_player2, team_b_player1, team_b_player2, status, started_at, finished_at",
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

  const sponsorUrl = existsSync(join(process.cwd(), "public", SPONSOR_FILE))
    ? `/${SPONSOR_FILE}`
    : null;

  // Num browser normal o fundo é escuro (pré-visualização fiel à transmissão).
  // Dentro do OBS existe window.obsstudio e o script repõe transparente para
  // se ver o vídeo. ?bg=transparent força transparente noutros webviews
  // (ex.: YoloBox).
  const forceTransparent = bg === "transparent";

  return (
    <>
      <style>{`
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          height: 100% !important;
          overflow: hidden !important;
          background: ${forceTransparent ? "transparent" : "#101010"} !important;
        }
      `}</style>
      {!forceTransparent && (
        <script
          dangerouslySetInnerHTML={{
            __html: `if (window.obsstudio) document.documentElement.style.setProperty('background', 'transparent', 'important');`,
          }}
        />
      )}
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
          sponsorUrl={sponsorUrl}
          size={size}
        />
      </div>
    </>
  );
}
