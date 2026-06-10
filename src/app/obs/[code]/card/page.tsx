import { existsSync } from "node:fs";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  IntervalCard,
  INTERVAL_BASE_W,
  INTERVAL_BASE_H,
} from "@/components/IntervalCard";
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
 * ?scale=N multiplica os pixels (mesma regra do /obs/{code}).
 */
export default async function ObsIntervalCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ scale?: string; bg?: string; size?: string }>;
}) {
  const { code } = await params;
  const { scale: scaleRaw, bg, size: sizeRaw } = await searchParams;
  const scale = (() => {
    const n = Number(scaleRaw);
    if (!Number.isFinite(n)) return 1;
    return Math.min(5, Math.max(0.5, n));
  })();
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

  const h = Math.round(INTERVAL_BASE_H * scale);

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
      {/* Dimensionamento: o cartão ocupa size% da largura da janela/Browser
          Source E nunca excede a altura disponível — nunca corta em nenhuma
          direcção. O zoom é aplicado ao #sb-mount, que o polling mantém. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){
            var W = ${Math.round(INTERVAL_BASE_W * scale)};
            var H = ${h};
            var SIZE = ${size};
            function fit(){
              var m = document.getElementById('sb-mount');
              if (!m) return;
              var z = Math.min(SIZE * window.innerWidth / W, window.innerHeight / H);
              m.style.width = W + 'px';
              m.style.zoom = z;
              // centra horizontalmente (a margem é em unidades já com zoom)
              m.style.marginLeft = Math.max(0, (window.innerWidth - W * z) / 2 / z) + 'px';
            }
            window.addEventListener('resize', fit);
            // 1º fit adiado para depois da hidratação do React (evita
            // mismatch de atributos no arranque).
            window.addEventListener('load', fit);
            setTimeout(fit, 400);
          })();`,
        }}
      />
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
          scale={scale}
        />
      </div>
    </>
  );
}
