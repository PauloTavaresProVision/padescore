import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { Scoreboard } from "@/components/Scoreboard";
import { ScoreboardStrip } from "@/components/ScoreboardStrip";
import { resolveStartedAt } from "@/lib/scoring/started-at";
import { configFromMatch } from "@/lib/scoring/apply";

export const dynamic = "force-dynamic";

// Browser Source de referência (Full HD). O overlay renderiza em PIXELS
// REAIS 1:1 dentro deste canvas — nada de CSS zoom/scale (que borraria).
const REF_W = 1920;
const REF_H = 1080;
const EDGE_PAD = 40; // margem às bordas no modo posicionado

// Dimensões base (scale=1) de cada layout. Espelham as constantes internas
// dos componentes — que, sendo "use client", chegariam a este Server
// Component como client-references (funções), não como números. Classic
// SCOREBOARD_BASE_W×H = 735×208; strip STRIP_BASE_W×H = 672×150.
const DIMS = {
  classic: { w: 735, h: 208 },
  strip: { w: 672, h: 150 },
} as const;

export default async function ObsOverlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{
    scale?: string;
    layout?: string;
    size?: string;
    pos?: string;
  }>;
}) {
  const { code } = await params;
  const {
    scale: scaleRaw,
    layout: layoutRaw,
    size: sizeRaw,
    pos: posRaw,
  } = await searchParams;

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
      .select("*")
      .eq("id", match.tournament_id)
      .single(),
    supabase.from("match_state").select("*").eq("match_id", match.id).single(),
  ]);
  if (!tournament) notFound();

  // Layout do overlay: setting do torneio (tournaments.obs_layout) com
  // override ?layout=strip|classic para preview/transição sem mexer no admin.
  const layout =
    layoutRaw === "strip" || layoutRaw === "classic"
      ? layoutRaw
      : ((tournament as { obs_layout?: string }).obs_layout ?? "classic");
  const isStrip = layout === "strip";
  const BASE_W = isStrip ? DIMS.strip.w : DIMS.classic.w;
  const BASE_H = isStrip ? DIMS.strip.h : DIMS.classic.h;

  // ── Dois modos ────────────────────────────────────────────────────────
  // LEGACY (retrocompat YoloBox): ?scale dado e SEM ?size/?pos → o body é
  // exactamente do tamanho do overlay (BASE×scale) e o YoloBox capta 1:1.
  //
  // POSICIONADO (default, igual ao cartão de intervalo): Browser Source
  // 1920×1080, o overlay renderiza em pixels reais e coloca-se num canto
  // via ?pos, com o tamanho dado por ?size (fracção da largura). Nunca é
  // preciso esticar a fonte no OBS → nitidez nativa.
  const legacy = scaleRaw != null && sizeRaw == null && posRaw == null;

  let scale: number;
  if (legacy) {
    const n = Number(scaleRaw);
    scale = Number.isFinite(n) ? Math.min(5, Math.max(0.5, n)) : 1;
  } else {
    // ?size = fracção da largura de 1920 ocupada pelo overlay (default 40%).
    // Limitado também pela altura para nunca cortar. scale = px / BASE.
    const sizeFrac = (() => {
      const n = Number(sizeRaw);
      if (!Number.isFinite(n)) return 0.4;
      return Math.min(100, Math.max(10, n)) / 100;
    })();
    const byWidth = (sizeFrac * REF_W) / BASE_W;
    const byHeight = (0.9 * REF_H) / BASE_H;
    scale = Math.min(byWidth, byHeight);
  }

  // Posição no canvas (modo posicionado). "vert-horz", default bottom-left.
  const { alignItems, justifyContent } = parsePos(posRaw);

  const w = Math.round(BASE_W * scale);
  const h = Math.round(BASE_H * scale);

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

  // CSS do body: legacy → tamanho do overlay; posicionado → viewport
  // 1920×1080 transparente com o overlay encostado a um canto.
  const bodyCss = legacy
    ? `
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: ${w}px !important;
          height: ${h}px !important;
          overflow: hidden !important;
          background: transparent !important;
        }
      `
    : `
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          height: 100% !important;
          overflow: hidden !important;
          background: transparent !important;
        }
        #sb-mount {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: ${alignItems};
          justify-content: ${justifyContent};
          padding: ${EDGE_PAD}px;
          box-sizing: border-box;
        }
        /* o overlay tem largura/altura fixas (pixels reais) — não deixar o
           flex comprimi-lo */
        #sb-mount > * { flex: 0 0 auto; }
      `;

  const board = isStrip ? (
    <ScoreboardStrip
      match={match}
      tournament={tournament}
      config={configFromMatch(match)}
      initialState={state ?? EMPTY_STATE}
      preferShortNames
      scale={scale}
      live={false}
    />
  ) : (
    <Scoreboard
      match={match}
      tournament={tournament}
      config={configFromMatch(match)}
      initialState={state ?? EMPTY_STATE}
      variant="overlay"
      preferShortNames
      scale={scale}
      initialElapsedSeconds={initialElapsedSeconds}
      live={false}
    />
  );

  return (
    // O scoreboard renderiza em PIXELS REAIS escalados (não CSS scale/zoom).
    // No modo posicionado fica num Browser Source 1920×1080 e encosta-se a
    // um canto — sem transformações, nitidez nativa.
    <>
      <style>{bodyCss}</style>
      {/* sb-mount: o script no layout substitui este innerHTML a cada 1s
          com o HTML novo vindo de uma nova requisição à mesma URL. */}
      <div id="sb-mount">{board}</div>
    </>
  );
}

/**
 * Posição no canvas → flex align/justify. Aceita "vert-horz" em qualquer
 * ordem: top|middle|bottom + left|center|right (ex.: "bottom-left",
 * "top-right", "middle-center"). Default: top-left.
 */
function parsePos(raw: string | undefined): {
  alignItems: string;
  justifyContent: string;
} {
  const parts = (raw ?? "top-left").toLowerCase().split(/[-_ ]/);
  const has = (k: string) => parts.includes(k);
  // Convenção sem ambiguidade: vertical usa top/middle/bottom; horizontal
  // usa left/center/right. ("middle" = centro vertical, "center" = horizontal.)
  const alignItems = has("top")
    ? "flex-start"
    : has("middle")
      ? "center"
      : "flex-end"; // default bottom
  const justifyContent = has("right")
    ? "flex-end"
    : has("center")
      ? "center"
      : "flex-start"; // default left
  return { alignItems, justifyContent };
}

const EMPTY_STATE = {
  points_a: "0",
  points_b: "0",
  games_a: 0,
  games_b: 0,
  sets_a: 0,
  sets_b: 0,
  sets_history: [],
  server: "A" as const,
  in_tiebreak: false,
  in_super_tiebreak: false,
  is_finished: false,
  winner: null,
};
