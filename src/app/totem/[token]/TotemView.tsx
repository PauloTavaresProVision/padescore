"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ============================================================================
// TYPES
// ============================================================================
export interface Player {
  name: string;
  shortName: string | null;
  photoUrl: string | null;
}
export interface MatchData {
  id: string;
  status: string;
  scheduledAt: string | null;
  teamA: { p1: Player | null; p2: Player | null };
  teamB: { p1: Player | null; p2: Player | null };
}
export interface Sponsor {
  imageUrl: string;
  durationSec?: number;
}
export interface TotemPayload {
  tournament: {
    name: string;
    logoUrl: string | null;
    primaryColor: string;
  } | null;
  court: string;
  currentMatch: MatchData | null;
  nextMatch: MatchData | null;
  sponsors: {
    footer: Sponsor[];
    fullscreen: Sponsor[];
  };
  serverTime: string;
}

// ============================================================================
// CONSTANTS — porto do HTML do user (mupi-open-padel-192x640.html)
// ============================================================================
const POLL_INTERVAL_MS = 15_000;
const MAIN_SCENE_MS = 20_000;

const BLUE = "#2d8cff";
const CYAN = "#12c8ff";
const LIME = "#9bf000";

// Fontes do design: Impact / Arial Black. Comum em Windows; fallback Arial.
const FONT_DISPLAY = `Impact, "Arial Black", Arial, sans-serif`;
const FONT_BODY = `Arial, sans-serif`;

// ============================================================================
// TotemView
// ============================================================================
export function TotemView({ token }: { token: string }) {
  const [data, setData] = useState<TotemPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const etagRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const headers: HeadersInit = {};
        if (etagRef.current) headers["If-None-Match"] = etagRef.current;
        const res = await fetch(`/api/totem/${token}`, {
          headers,
          cache: "no-store",
        });
        if (cancelled) return;
        if (res.status === 304) return;
        if (!res.ok) {
          setError(`HTTP ${res.status}`);
          return;
        }
        const etag = res.headers.get("etag");
        if (etag) etagRef.current = etag;
        const json = (await res.json()) as TotemPayload;
        setData(json);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Network error");
      }
    }
    void poll();
    const id = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token]);

  const [cycleIdx, setCycleIdx] = useState(0);
  const fsCount = data?.sponsors.fullscreen.length ?? 0;
  useEffect(() => {
    if (fsCount === 0) return;
    const dur =
      cycleIdx === 0
        ? MAIN_SCENE_MS
        : (data?.sponsors.fullscreen[cycleIdx - 1]?.durationSec ?? 8) * 1000;
    const t = setTimeout(
      () => setCycleIdx((i) => (i + 1) % (fsCount + 1)),
      dur,
    );
    return () => clearTimeout(t);
  }, [cycleIdx, fsCount, data]);

  if (error && !data) {
    return (
      <Stage>
        <StatusScene
          kind="error"
          title="SEM LIGAÇÃO"
          subtitle={error}
        />
      </Stage>
    );
  }
  if (!data) {
    return (
      <Stage>
        <StatusScene kind="loading" title="A CARREGAR" subtitle="Aguardar dados do torneio…" />
      </Stage>
    );
  }

  if (cycleIdx > 0) {
    const sp = data.sponsors.fullscreen[cycleIdx - 1];
    if (sp) {
      return (
        <Stage>
          <FullscreenSponsorScene imageUrl={sp.imageUrl} />
        </Stage>
      );
    }
  }

  return (
    <Stage>
      <MainScene data={data} />
    </Stage>
  );
}

// ============================================================================
// Stage — .poster do user com side arcs + dot field + radial mask
// ============================================================================
export function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        background: "#171717",
      }}
    >
      <div
        style={{
          width: 192,
          height: 640,
          transform: "scale(min(calc(100vh / 640), calc(100vw / 192)))",
          transformOrigin: "center center",
          flexShrink: 0,
          position: "relative",
          overflow: "hidden",
          color: "#fff",
          fontFamily: FONT_DISPLAY,
          background:
            "radial-gradient(circle at 50% 55%, rgba(0, 84, 255, .42), transparent 34%), radial-gradient(circle at 50% 18%, rgba(0, 36, 110, .55), transparent 35%), linear-gradient(180deg, #020713 0%, #020713 34%, #001334 64%, #020713 100%)",
          boxShadow: "0 0 0 1px rgba(255,255,255,.08)",
        }}
      >
        {/* Side arcs — ::before (esquerda) e ::after (direita) do HTML */}
        <div
          style={{
            position: "absolute",
            top: -64,
            left: -111,
            width: 170,
            height: 230,
            border: `1px solid rgba(45, 140, 255, .85)`,
            borderRadius: "50%",
            filter: `drop-shadow(0 0 7px ${BLUE})`,
            opacity: 0.75,
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: -64,
            right: -111,
            width: 170,
            height: 230,
            border: `1px solid rgba(45, 140, 255, .85)`,
            borderRadius: "50%",
            filter: `drop-shadow(0 0 7px ${BLUE})`,
            opacity: 0.75,
            pointerEvents: "none",
          }}
        />

        {/* Dot field com mask radial (mais denso no topo) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.38,
            backgroundImage:
              "radial-gradient(rgba(68, 165, 255, .85) 1px, transparent 1px)",
            backgroundSize: "7px 7px",
            WebkitMaskImage:
              "radial-gradient(circle at top center, #000 0 18%, transparent 42%)",
            maskImage:
              "radial-gradient(circle at top center, #000 0 18%, transparent 42%)",
            pointerEvents: "none",
          }}
        />

        {children}
      </div>
    </div>
  );
}

// ============================================================================
// MainScene
// ============================================================================
export function MainScene({ data }: { data: TotemPayload }) {
  // Tick a cada 30s para que a "imminence" do HORÁRIO (pulse quando faltam
  // <10min) reflicta o tempo real mesmo se os dados não mudaram.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const isLive = data.currentMatch?.status === "live";
  const scheduledAt = data.currentMatch?.scheduledAt ?? null;
  const imminent = scheduledAt
    ? (() => {
        const t = new Date(scheduledAt).getTime();
        const diffMin = (t - now) / 60_000;
        return diffMin > 0 && diffMin <= 10;
      })()
    : false;
  return (
    <section
      style={{
        position: "relative",
        zIndex: 1,
        height: "100%",
        padding: "7px 11px 6px",
        textAlign: "center",
        boxSizing: "border-box",
      }}
    >
      {/* Header marca */}
      <BrandHeader />

      {/* CAMPO */}
      <NeonBox
        style={{
          height: 30,
          display: "grid",
          placeItems: "center",
          marginBottom: 5,
          fontSize: 23,
          lineHeight: 1,
          letterSpacing: "1px",
        }}
      >
        {data.court.toUpperCase()}
      </NeonBox>

      {data.currentMatch ? (
        <>
          <Divider color={LIME}>DUPLA A</Divider>
          <PlayersRow team={data.currentMatch.teamA} />
          <NamesBox team={data.currentMatch.teamA} />

          <Vs />

          <Divider color={LIME}>DUPLA B</Divider>
          <PlayersRow team={data.currentMatch.teamB} />
          <NamesBox team={data.currentMatch.teamB} />

          {isLive ? (
            <LiveBox />
          ) : data.currentMatch.scheduledAt ? (
            <TimeBox
              scheduledAt={data.currentMatch.scheduledAt}
              imminent={imminent}
            />
          ) : null}
        </>
      ) : (
        <NoMatch />
      )}

      {data.nextMatch && <NextBox match={data.nextMatch} />}

      <SponsorsRow sponsors={data.sponsors.footer} />
    </section>
  );
}

// ============================================================================
// BRAND HEADER — logo SVG + OPEN PADEL + 2026 + ANGOLA
// ============================================================================
function BrandHeader() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/totem/standard-bank-angola.svg"
        alt=""
        style={{
          width: 79,
          height: "auto",
          display: "block",
          margin: "0 auto 3px",
          filter: "drop-shadow(0 0 7px rgba(45, 140, 255, .95))",
        }}
      />
      <div
        style={{
          fontSize: 25,
          lineHeight: 0.9,
          fontStyle: "italic",
          letterSpacing: "0.3px",
          textShadow: "0 0 8px rgba(255,255,255,.45)",
        }}
      >
        OPEN PADEL
      </div>
      <div
        style={{
          color: LIME,
          fontSize: 21,
          lineHeight: 1,
          letterSpacing: "1px",
          textShadow: "0 0 8px rgba(155,240,0,.65)",
        }}
      >
        2026
      </div>
      {/* ANGOLA com linhas decorativas cyan dos dois lados */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: 8,
          margin: "0 11px 3px",
          fontFamily: FONT_BODY,
          fontWeight: 900,
          fontSize: 8,
          letterSpacing: "7px",
        }}
      >
        <span
          style={{
            height: 1,
            background: `linear-gradient(90deg, transparent, ${CYAN})`,
            boxShadow: `0 0 7px ${CYAN}`,
          }}
        />
        <span>ANGOLA</span>
        <span
          style={{
            height: 1,
            background: `linear-gradient(90deg, ${CYAN}, transparent)`,
            boxShadow: `0 0 7px ${CYAN}`,
          }}
        />
      </div>
    </>
  );
}

// ============================================================================
// NEON BOX — caixa azul com border + glow (.neon-box do user)
// ============================================================================
function NeonBox({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        border: "1px solid rgba(65, 162, 255, .98)",
        borderRadius: 5,
        boxShadow:
          "inset 0 0 7px rgba(45, 140, 255, .55), 0 0 8px rgba(45, 140, 255, .75)",
        background: "rgba(2, 10, 30, .74)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ============================================================================
// DIVIDER (DUPLA A/B com linhas lime nos lados)
// ============================================================================
function Divider({
  children,
  color,
}: {
  children: React.ReactNode;
  color: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        gap: 7,
        margin: "0 11px 1px",
        color,
        fontSize: 12,
        fontStyle: "italic",
        letterSpacing: "0.8px",
        textShadow: `0 0 8px ${color}cc`,
      }}
    >
      <span
        style={{
          height: 1,
          background: `linear-gradient(90deg, transparent, ${color})`,
          boxShadow: `0 0 8px ${color}`,
        }}
      />
      <span>{children}</span>
      <span
        style={{
          height: 1,
          background: `linear-gradient(90deg, ${color}, transparent)`,
          boxShadow: `0 0 8px ${color}`,
        }}
      />
    </div>
  );
}

// ============================================================================
// PLAYERS ROW — duas fotos lado a lado com drop-shadow azul
// ============================================================================
function PlayersRow({
  team,
}: {
  team: { p1: Player | null; p2: Player | null };
}) {
  return (
    <div
      style={{
        position: "relative",
        height: 86,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 0,
        alignItems: "end",
        margin: "0 0 -2px",
      }}
    >
      <PlayerCell player={team.p1} side="left" />
      <PlayerCell player={team.p2} side="right" />
    </div>
  );
}

function PlayerCell({
  player,
  side,
}: {
  player: Player | null;
  side: "left" | "right";
}) {
  // Foto encostada ao centro do totem: a foto esquerda alinha-se à direita
  // da sua célula, a foto direita alinha-se à esquerda — assim os jogadores
  // parecem ombro-a-ombro em vez de cada um centrado na sua metade.
  const objectPosition =
    side === "left" ? "75% bottom" : "25% bottom";
  return (
    <div
      style={{
        height: 84,
        position: "relative",
        filter: "drop-shadow(0 0 11px rgba(0,119,255,.9))",
      }}
    >
      {player?.photoUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={player.photoUrl}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            objectPosition,
          }}
        />
      ) : (
        // Placeholder silhueta minimalista (cabeça + corpo)
        <>
          <div
            style={{
              position: "absolute",
              left: side === "left" ? "65%" : "35%",
              top: 0,
              width: 33,
              height: 33,
              transform: "translateX(-50%)",
              borderRadius: "50% 50% 44% 44%",
              background:
                "radial-gradient(circle at 35% 38%, rgba(255,255,255,.55), transparent 12%), linear-gradient(180deg, #f0ba8b, #9b5d3c)",
              boxShadow: "inset 0 -3px 0 rgba(0,0,0,.18)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: side === "left" ? "65%" : "35%",
              bottom: 0,
              width: 60,
              height: 58,
              transform: "translateX(-50%)",
              borderRadius: "22px 22px 10px 10px",
              background:
                "linear-gradient(36deg, transparent 0 26%, rgba(245, 196, 150, .95) 27% 38%, transparent 39%), linear-gradient(-35deg, transparent 0 26%, rgba(194, 124, 82, .95) 27% 38%, transparent 39%), linear-gradient(135deg, #222d35, #07101d)",
            }}
          />
        </>
      )}
    </div>
  );
}

// ============================================================================
// NAMES BOX
// ============================================================================
function NamesBox({
  team,
}: {
  team: { p1: Player | null; p2: Player | null };
}) {
  return (
    <NeonBox
      style={{
        minHeight: 38,
        display: "grid",
        placeItems: "center",
        margin: "0 0 2px",
        padding: "3px 5px",
        fontSize: 13,
        lineHeight: 1.15,
        letterSpacing: "1px",
        textShadow: "0 0 7px rgba(255,255,255,.45)",
      }}
    >
      <div>
        {team.p1 && (
          <div>{(team.p1.shortName ?? team.p1.name).toUpperCase()}</div>
        )}
        {team.p2 && (
          <div>{(team.p2.shortName ?? team.p2.name).toUpperCase()}</div>
        )}
      </div>
    </NeonBox>
  );
}

// ============================================================================
// VS
// ============================================================================
function Vs() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        gap: 11,
        margin: "4px 10px 1px",
        color: LIME,
        fontSize: 32,
        lineHeight: 1,
        fontStyle: "italic",
        textShadow: `0 0 11px rgba(155,240,0,.8)`,
      }}
    >
      <span
        style={{
          height: 2,
          background: `linear-gradient(90deg, transparent, ${LIME})`,
          boxShadow: `0 0 8px ${LIME}`,
        }}
      />
      <span>VS</span>
      <span
        style={{
          height: 2,
          background: `linear-gradient(90deg, ${LIME}, transparent)`,
          boxShadow: `0 0 8px ${LIME}`,
        }}
      />
    </div>
  );
}

// ============================================================================
// TIME BOX (HORÁRIO DO JOGO) — neon-box com border lime
// imminent = jogo começa nos próximos 10min → pulse para chamar atenção
// ============================================================================
function TimeBox({
  scheduledAt,
  imminent,
}: {
  scheduledAt: string;
  imminent: boolean;
}) {
  const d = new Date(scheduledAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return (
    <div
      style={{
        height: 52,
        display: "grid",
        placeItems: "center",
        margin: "3px 0 4px",
        border: `1px solid rgba(155, 240, 0, .95)`,
        borderRadius: 5,
        background: "rgba(2, 10, 30, .74)",
        boxShadow:
          "inset 0 0 6px rgba(155,240,0,.35), 0 0 8px rgba(155,240,0,.55)",
        animation: imminent
          ? "totem-imminent 1.6s ease-in-out infinite"
          : undefined,
      }}
    >
      {imminent && (
        <style>{`@keyframes totem-imminent {
          0%, 100% { box-shadow: inset 0 0 6px rgba(155,240,0,.35), 0 0 8px rgba(155,240,0,.55); }
          50% { box-shadow: inset 0 0 12px rgba(155,240,0,.85), 0 0 22px rgba(155,240,0,.95); }
        }`}</style>
      )}
      <div
        style={{
          display: "grid",
          gap: 3,
          justifyItems: "center",
          alignContent: "center",
          paddingTop: 2,
        }}
      >
        <div
          style={{
            color: LIME,
            fontSize: 10,
            letterSpacing: "0.7px",
            lineHeight: 1.05,
          }}
        >
          HORÁRIO DO JOGO
        </div>
        <div
          style={{
            fontSize: 30,
            lineHeight: 0.82,
            letterSpacing: "1px",
            textShadow: "0 0 8px rgba(155,240,0,.55)",
          }}
        >
          {time}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// LIVE BOX — substitui o HORÁRIO quando status === 'live'.
// Mesma dimensão do TimeBox para não desestabilizar o layout, mas tom red
// + pulsing dot. Foca a atenção em "está a acontecer agora".
// ============================================================================
function LiveBox() {
  return (
    <div
      style={{
        height: 52,
        display: "grid",
        placeItems: "center",
        margin: "3px 0 4px",
        border: "1px solid rgba(255, 69, 84, .95)",
        borderRadius: 5,
        background: "rgba(2, 10, 30, .74)",
        boxShadow:
          "inset 0 0 6px rgba(255,69,84,.35), 0 0 8px rgba(255,69,84,.55)",
      }}
    >
      <style>{`@keyframes totem-live-dot {
        0%, 100% { opacity: 1; box-shadow: 0 0 9px rgba(255,69,84,.9); }
        50% { opacity: .5; box-shadow: 0 0 3px rgba(255,69,84,.3); }
      }`}</style>
      <div
        style={{
          display: "grid",
          gap: 4,
          justifyItems: "center",
          alignContent: "center",
          paddingTop: 2,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#ff4554",
              animation: "totem-live-dot 1.2s ease-in-out infinite",
            }}
          />
          <span
            style={{
              color: "#ff8a96",
              fontSize: 10,
              letterSpacing: "0.7px",
              lineHeight: 1.05,
              fontFamily: FONT_BODY,
              fontWeight: 900,
            }}
          >
            EM DIRECTO
          </span>
        </div>
        <div
          style={{
            color: "#fff",
            fontSize: 30,
            lineHeight: 0.82,
            letterSpacing: "2px",
            textShadow: "0 0 10px rgba(255,69,84,.7)",
          }}
        >
          AO VIVO
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// NEXT BOX (A SEGUIR)
// ============================================================================
function NextBox({ match }: { match: MatchData }) {
  const pa1 = match.teamA.p1?.shortName ?? match.teamA.p1?.name ?? "?";
  const pa2 = match.teamA.p2
    ? ` | ${match.teamA.p2.shortName ?? match.teamA.p2.name}`
    : "";
  const pb1 = match.teamB.p1?.shortName ?? match.teamB.p1?.name ?? "?";
  const pb2 = match.teamB.p2
    ? ` | ${match.teamB.p2.shortName ?? match.teamB.p2.name}`
    : "";
  return (
    <NeonBox
      style={{
        minHeight: 59,
        padding: "4px 5px",
        display: "grid",
        placeItems: "center",
        fontFamily: FONT_BODY,
        fontWeight: 900,
        textTransform: "uppercase",
      }}
    >
      <div style={{ width: "100%" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            gap: 7,
            alignItems: "center",
            color: CYAN,
            fontSize: 12,
            letterSpacing: "0.8px",
            marginBottom: 2,
          }}
        >
          <span
            style={{
              height: 1,
              background: `linear-gradient(90deg, transparent, ${CYAN})`,
              boxShadow: `0 0 6px ${CYAN}`,
            }}
          />
          <span>A SEGUIR</span>
          <span
            style={{
              height: 1,
              background: `linear-gradient(90deg, ${CYAN}, transparent)`,
              boxShadow: `0 0 6px ${CYAN}`,
            }}
          />
        </div>
        <div style={{ fontSize: 9, letterSpacing: "1px", lineHeight: 1.35 }}>
          {pa1.toUpperCase()}
          {pa2.toUpperCase()}
        </div>
        <div
          style={{
            color: LIME,
            fontSize: 15,
            lineHeight: 1,
            fontFamily: FONT_DISPLAY,
          }}
        >
          VS
        </div>
        <div style={{ fontSize: 9, letterSpacing: "1px", lineHeight: 1.35 }}>
          {pb1.toUpperCase()}
          {pb2.toUpperCase()}
        </div>
      </div>
    </NeonBox>
  );
}

// ============================================================================
// SPONSORS — slideshow crossfade de pares de sponsors
// ----------------------------------------------------------------------------
// Em vez de marquee (que cortava logos nos extremos do fade), uso slides com
// 2 sponsors cada um, completamente visíveis. A cada SLIDE_MS o slide actual
// faz fade-out + scale-down ligeiro e o próximo entra com fade-in + scale-up.
// O resultado é um cartaz de patrocinadores rotativo, limpo, sem clipping —
// cada logo tem o seu momento "em destaque".
// ============================================================================
const SLIDE_MS = 5000;
const SLIDE_FADE_MS = 800;
const PER_SLIDE = 2;

function SponsorsRow({ sponsors }: { sponsors: Sponsor[] }) {
  const slides = useMemo(() => {
    const out: Sponsor[][] = [];
    for (let i = 0; i < sponsors.length; i += PER_SLIDE) {
      out.push(sponsors.slice(i, i + PER_SLIDE));
    }
    return out;
  }, [sponsors]);

  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setTimeout(
      () => setActiveIdx((i) => (i + 1) % slides.length),
      SLIDE_MS,
    );
    return () => clearTimeout(t);
  }, [activeIdx, slides.length]);

  if (slides.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: 7,
        right: 7,
        bottom: 6,
        height: 32,
      }}
    >
      {slides.map((slide, i) => {
        const isActive = i === activeIdx;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              gridTemplateColumns:
                slide.length === 1 ? "1fr" : "1fr 1fr",
              gap: 7,
              placeItems: "center",
              opacity: isActive ? 1 : 0,
              transform: `scale(${isActive ? 1 : 0.94})`,
              transition: `opacity ${SLIDE_FADE_MS}ms ease, transform ${SLIDE_FADE_MS}ms ease`,
              pointerEvents: isActive ? "auto" : "none",
            }}
          >
            {slide.map((s, j) => (
              <SponsorPill key={j} sponsor={s} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function SponsorPill({ sponsor }: { sponsor: Sponsor }) {
  return (
    <div
      style={{
        height: 32,
        width: "100%",
        minWidth: 0,
        padding: "4px 9px",
        borderRadius: 8,
        background:
          "linear-gradient(180deg, #ffffff 0%, #eef2fb 65%, #d8e1f0 100%)",
        boxShadow:
          "0 0 14px rgba(45, 140, 255, .65), 0 0 0 1px rgba(160, 200, 255, .55), inset 0 1px 0 rgba(255, 255, 255, 1), inset 0 -2px 4px rgba(0, 40, 90, .12)",
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={sponsor.imageUrl}
        alt=""
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          width: "auto",
          objectFit: "contain",
          display: "block",
        }}
      />
    </div>
  );
}

// ============================================================================
// STATUS SCENE — carrega / erro com branding (não parece app crashed)
// ============================================================================
function StatusScene({
  kind,
  title,
  subtitle,
}: {
  kind: "loading" | "error";
  title: string;
  subtitle: string;
}) {
  const color = kind === "error" ? "#ff4554" : BLUE;
  const glow = kind === "error" ? "rgba(255,69,84,.75)" : "rgba(45,140,255,.75)";
  return (
    <section
      style={{
        position: "relative",
        zIndex: 1,
        height: "100%",
        padding: "7px 11px 6px",
        textAlign: "center",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`
        @keyframes totem-spin { to { transform: rotate(360deg); } }
        @keyframes totem-pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .55; transform: scale(.88); }
        }
      `}</style>
      <BrandHeader />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          padding: "24px 8px 80px",
        }}
      >
        {kind === "loading" ? (
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: "50%",
              border: `3px solid rgba(45,140,255,.2)`,
              borderTopColor: color,
              animation: "totem-spin 1s linear infinite",
              boxShadow: `0 0 18px ${glow}`,
            }}
          />
        ) : (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: color,
              boxShadow: `0 0 22px ${glow}, inset 0 -3px 6px rgba(0,0,0,.18)`,
              animation: "totem-pulse-dot 1.4s ease-in-out infinite",
            }}
          />
        )}
        <div
          style={{
            fontSize: 18,
            letterSpacing: "1.5px",
            color: "#fff",
            textShadow: `0 0 10px ${glow}`,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 9,
            color: "rgba(255,255,255,.55)",
            letterSpacing: ".5px",
            fontFamily: FONT_BODY,
            fontWeight: 700,
            maxWidth: 160,
            lineHeight: 1.35,
            wordBreak: "break-word",
          }}
        >
          {subtitle}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// EMPTY + FULLSCREEN
// ============================================================================
function NoMatch() {
  return (
    <div style={{ padding: "30px 14px", textAlign: "center" }}>
      <div
        style={{
          fontSize: 13,
          color: "#94a3b8",
          letterSpacing: "1.5px",
          marginBottom: 6,
          fontFamily: FONT_BODY,
          fontWeight: 900,
        }}
      >
        SEM JOGO ACTUAL
      </div>
      <div
        style={{
          fontSize: 10,
          color: "#64748b",
          fontFamily: FONT_BODY,
        }}
      >
        Não há jogos marcados para este campo.
      </div>
    </div>
  );
}

function FullscreenSponsorScene({ imageUrl }: { imageUrl: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        padding: 4,
        background: "#000",
        position: "relative",
        zIndex: 2,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt=""
        style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
      />
    </div>
  );
}
