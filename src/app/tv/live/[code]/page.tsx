import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { TVScoreboard } from "@/components/TVScoreboard";
import { FullscreenButton } from "@/components/FullscreenButton";
import { resolveStartedAt } from "@/lib/scoring/started-at";
import { configFromMatch } from "@/lib/scoring/apply";
import { TvLivePoller } from "./TvLivePoller";

export const dynamic = "force-dynamic";

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

/**
 * Canal de TV do torneio. Link FIXO que se abre uma vez no browser da TV
 * (fullscreen). Mostra o jogo que o operador pôs "no ar"; troca sozinho
 * via poll quando o operador muda de jogo, sem ninguém ir à TV.
 */
export default async function TvLivePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = createAdminClient();

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("*")
    .eq("tv_code", code.toLowerCase())
    .single();

  if (!tournament) notFound();

  // Sem jogo no ar → ecrã de espera (com o poller a vigiar).
  if (!tournament.tv_active_match_id) {
    return (
      <>
        <TvLivePoller code={code} activeCode={null} />
        <StandbyScreen
          name={tournament.name}
          standbyUrl={tournament.tv_standby_url}
        />
        <FullscreenButton />
      </>
    );
  }

  const { data: match } = await supabase
    .from("matches")
    .select(
      "id, tournament_id, short_code, court_name, category, team_a_player1, team_a_player2, team_b_player1, team_b_player2, team_a_photo_url, team_b_photo_url, status, started_at, finished_at, golden_point, sets_to_win, games_per_set, tiebreak_at, tiebreak_points, final_set_super_tiebreak",
    )
    .eq("id", tournament.tv_active_match_id)
    .single();

  // Jogo apagado entretanto → trata como espera.
  if (!match) {
    return (
      <>
        <TvLivePoller code={code} activeCode={null} />
        <StandbyScreen
          name={tournament.name}
          standbyUrl={tournament.tv_standby_url}
        />
        <FullscreenButton />
      </>
    );
  }

  const serverNow = Date.now();
  match.started_at = await resolveStartedAt(
    supabase,
    match.id,
    match.started_at,
  );

  // Tempo decorrido calculado no SERVIDOR (igual a /tv/[code]).
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

  const { data: state } = await supabase
    .from("match_state")
    .select("*")
    .eq("match_id", match.id)
    .single();

  return (
    <>
      <TvLivePoller code={code} activeCode={match.short_code} />
      {/* key força re-mount limpo quando o jogo activo muda */}
      <TVScoreboard
        key={match.id}
        match={match}
        tournament={tournament}
        config={configFromMatch(match)}
        initialElapsedSeconds={initialElapsedSeconds}
        initialState={state ?? EMPTY_STATE}
      />
      <FullscreenButton />
    </>
  );
}

function StandbyScreen({
  name,
  standbyUrl,
}: {
  name: string;
  standbyUrl: string | null | undefined;
}) {
  // Imagem dedicada (já tem texto/branding) → mostra tal e qual, só com
  // animação ambiente (respiração + sweep), SEM texto sobreposto.
  if (standbyUrl) {
    return (
      <div style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={standbyUrl}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "fill",
            transformOrigin: "center center",
            animation: "tvlive-breathe 9s ease-in-out infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            mixBlendMode: "screen",
            background:
              "linear-gradient(110deg, transparent 38%, rgba(255,255,255,.05) 49%, rgba(66,215,255,.08) 50%, rgba(255,255,255,.05) 51%, transparent 62%)",
            backgroundSize: "250% 100%",
            backgroundPosition: "-100% 0",
            animation: "tvlive-sweep 13s linear infinite",
          }}
        />
        <style>{`
          @keyframes tvlive-sweep { 0%{background-position:-100% 0} 100%{background-position:250% 0} }
          @keyframes tvlive-breathe {
            0%,100% { transform: scale(1); filter: brightness(1) saturate(1); }
            50%     { transform: scale(1.025); filter: brightness(1.08) saturate(1.12); }
          }
        `}</style>
      </div>
    );
  }

  // Sem imagem dedicada → ecrã genérico animado.
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        fontFamily: '"Arial Narrow", "Roboto Condensed", Arial, sans-serif',
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 40%, #0e2a4a 0%, #071a30 45%, #03101f 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          mixBlendMode: "screen",
          background:
            "linear-gradient(110deg, transparent 38%, rgba(255,255,255,.05) 49%, rgba(66,215,255,.08) 50%, rgba(255,255,255,.05) 51%, transparent 62%)",
          backgroundSize: "250% 100%",
          backgroundPosition: "-100% 0",
          animation: "tvlive-sweep 13s linear infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: "3vh",
          opacity: 0,
          animation: "tvlive-rise 800ms cubic-bezier(.16,1,.3,1) 150ms forwards",
        }}
      >
        <div
          style={{
            fontSize: "2.6vw",
            fontWeight: 900,
            textTransform: "uppercase",
            color: "#cdeaff",
          }}
        >
          {name}
        </div>
        <div
          style={{
            maxWidth: "72%",
            fontSize: "7vw",
            fontWeight: 900,
            lineHeight: 1.04,
            textTransform: "uppercase",
            color: "#fff",
            letterSpacing: "0.01em",
            animation: "tvlive-glow 3s ease-in-out infinite",
          }}
        >
          AGUARDE O PRÓXIMO JOGO
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1.4vw",
            fontSize: "1.9vw",
            fontWeight: 800,
            fontStyle: "italic",
            color: "#42d7ff",
            letterSpacing: "0.08em",
            textShadow: "0 0 18px rgba(66,215,255,.6)",
            animation: "tvlive-pulse 2.6s ease-in-out infinite",
          }}
        >
          <span className="tvlive-line" />
          Em instantes
          <span className="tvlive-line" />
        </div>
      </div>
      <style>{`
        @keyframes tvlive-pulse { 0%,100%{opacity:.7} 50%{opacity:1} }
        @keyframes tvlive-rise { 0%{opacity:0;transform:translateY(2vh) scale(.97)} 100%{opacity:1;transform:none} }
        @keyframes tvlive-sweep { 0%{background-position:-100% 0} 100%{background-position:250% 0} }
        @keyframes tvlive-glow {
          0%,100% { text-shadow: 0 0 26px rgba(255,255,255,.55), 0 0 60px rgba(66,215,255,.45), 0 6px 18px rgba(0,0,0,.7); }
          50%     { text-shadow: 0 0 40px rgba(255,255,255,.85), 0 0 100px rgba(66,215,255,.75), 0 6px 18px rgba(0,0,0,.7); }
        }
        @keyframes tvlive-line-grow { to { width: 6vw; } }
        .tvlive-line {
          display:inline-block; width:0; height:2px; border-radius:999px;
          background:linear-gradient(90deg, transparent, #42d7ff 40%, #42d7ff 60%, transparent);
          box-shadow:0 0 10px rgba(66,215,255,.7);
          animation: tvlive-line-grow 900ms cubic-bezier(.16,1,.3,1) 450ms forwards;
        }
      `}</style>
    </div>
  );
}
