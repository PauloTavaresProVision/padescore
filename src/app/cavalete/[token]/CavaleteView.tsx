"use client";

// =============================================================================
// CAVALETE 1080×1920 — Cena Principal
// Versão estável: PNG do designer só no header (crop), restante em CSS
// alinhado ao estilo do mockup. Funciona com dados reais do PadelTeams.
// =============================================================================

import { useEffect, useRef, useState } from "react";

// -----------------------------------------------------------------------------
// TIPOS
// -----------------------------------------------------------------------------
interface CavalettePlayer {
  padelteamsId: number;
  name: string;
  photoUrl: string | null;
}
interface CavaletteTeam {
  padelteamsId: number;
  name: string;
  players: CavalettePlayer[];
}
interface CavaletteGame {
  padelteamsId: number;
  startsAt: string;
  status: "open" | "closed";
  teamA: CavaletteTeam;
  teamB: CavaletteTeam;
  sets: { a: number; b: number; type: "set" | "tie" }[];
  scoreLabel: string | null;
  winner: 1 | 2 | null;
  isFeatured: boolean;
  court: { id: string; name: string } | null;
}
interface CavaletePayload {
  tournament: {
    name: string;
    sceneDurations: { mainSec: number; sponsorsSec: number };
  };
  cavalete: {
    name: string;
    courts: { id: string; name: string }[];
  };
  liveByCourt: (CavaletteGame | null)[];
  upcoming: CavaletteGame[];
  results: CavaletteGame[];
  featured: CavaletteGame[];
  sponsors: {
    footer: { imageUrl: string }[];
    fullscreen: { imageUrl: string; durationSec: number }[];
  };
  serverTime: string;
}

// -----------------------------------------------------------------------------
// CONSTANTES
// -----------------------------------------------------------------------------
const POLL_INTERVAL_MS = 15_000;
// Rotação dos logos de "NOSSOS PARCEIROS" (grid 3×2 = 6 slots). Quando há
// mais de 6 parceiros, cada slot alterna entre os seus logos a cada
// PARTNER_ROTATE_MS (+ pequeno stagger por slot para os fades não baterem
// todos ao mesmo tempo). A duração da cena sponsors estende-se sozinha para
// dar tempo a um ciclo completo (ver useEffect das cenas).
const PARTNER_ROTATE_MS = 6000;
const PARTNER_STAGGER_MS = 150;
const PARTNER_FADE_MS = 600;
const STAGE_W = 1080;
const STAGE_H = 1920;
// Cena Byte (scene-byte.png) — passa depois da publicidade, 5s.
const BYTE_SCENE_SEC = 5;
// Cena Focus (destaque/finais) — segundos por cada jogo em destaque.
const FOCUS_SCENE_SEC = 12;
// Versão dos PNGs de fundo (scene-*.png). Os webviews dos kiosks cacheiam
// imagens de forma agressiva: ao trocar um PNG mantendo o nome, alguns
// kiosks continuam a mostrar o antigo. INCREMENTAR este número sempre que
// um scene-*.png mudar força todos a buscar a versão nova (cache busting).
const SCENE_ASSET_VERSION = 2;
const HEADER_HEIGHT_PX = 405; // crop até final do "ANGOLA"

const BLUE = "#2d8cff";
const CYAN = "#12c8ff";
const LIME = "#9bf000";
const RED = "#ff4554";

const FONT_DISPLAY = `var(--font-cavalete-display), "Bebas Neue", "Anton", Impact, "Arial Black", Arial, sans-serif`;
const FONT_BODY = `Arial, "Helvetica Neue", sans-serif`;

// =============================================================================
// MAIN COMPONENT
// =============================================================================
// Erro tipado — usado para mostrar mensagem específica por código
interface FetchError {
  status: number; // 0 = network error
  hint?: string; // mensagem amigável do API (campo "hint" da resposta JSON)
  rawMessage?: string;
}

export function CavaleteView({ token }: { token: string }) {
  const [data, setData] = useState<CavaletePayload | null>(null);
  const [error, setError] = useState<FetchError | null>(null);
  const etagRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const qs =
      typeof window !== "undefined" ? window.location.search : "";
    async function poll() {
      try {
        const headers: HeadersInit = {};
        if (etagRef.current) headers["If-None-Match"] = etagRef.current;
        const res = await fetch(`/api/cavalete/${token}${qs}`, {
          headers,
          cache: "no-store",
        });
        if (cancelled) return;
        if (res.status === 304) return;
        if (!res.ok) {
          // Tenta extrair "error" + "hint" do body JSON do nosso endpoint
          let hint: string | undefined;
          let rawMessage: string | undefined;
          try {
            const body = await res.json();
            hint = body.hint || body.detail;
            rawMessage = body.error;
          } catch {
            // body não-JSON, ignora
          }
          setError({ status: res.status, hint, rawMessage });
          return;
        }
        const etag = res.headers.get("etag");
        if (etag) etagRef.current = etag;
        const json = (await res.json()) as CavaletePayload;
        setData(json);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setError({
          status: 0,
          rawMessage: e instanceof Error ? e.message : "Network error",
        });
      }
    }
    void poll();
    const id = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token]);

  // Rotação de cenas (ordem): Main (jogos) → Focus (destaques/finais) →
  // Sponsors (publicidade) → Byte. As cenas opcionais só entram se houver
  // conteúdo: focus se houver jogos em destaque; sponsors+byte se houver
  // patrocinadores.
  const hasSponsors =
    (data?.sponsors.footer.length ?? 0) +
      (data?.sponsors.fullscreen.length ?? 0) >
    0;
  const featuredGames = data?.featured ?? [];
  const hasFocus = featuredGames.length > 0;
  const scenes = buildScenes(hasFocus, hasSponsors);
  const nScenes = scenes.length;

  // Em dev/teste, ?scene=main|focus|sponsors|byte força uma cena (sem rotação)
  const url = typeof window !== "undefined" ? new URL(window.location.href) : null;
  const forceScene = url?.searchParams.get("scene");
  const nPartners = data?.sponsors.footer.length ?? 0;
  const [sceneIdx, setSceneIdx] = useState(0);
  useEffect(() => {
    const list = buildScenes(hasFocus, hasSponsors);
    if (forceScene) {
      const i = list.indexOf(forceScene as SceneName);
      return void setSceneIdx(i >= 0 ? i : 0);
    }
    if (list.length <= 1) return;
    const cur = list[sceneIdx % list.length];

    // Durações vêm do payload (configuradas por torneio no admin).
    const mainSec = data?.tournament.sceneDurations.mainSec ?? 40;
    const sponsorsCfgSec = data?.tournament.sceneDurations.sponsorsSec ?? 15;

    // Duração ADAPTATIVA da cena sponsors: cobre 1 ciclo de rotação dos
    // parceiros (slot mais cheio × stagger do slot mais lento + margem).
    const maxPerSlot = Math.ceil(nPartners / 6);
    const slowestSlotMs = PARTNER_ROTATE_MS + 5 * PARTNER_STAGGER_MS;
    const partnerCycleSec =
      maxPerSlot > 1 ? (maxPerSlot * slowestSlotMs) / 1000 + 1.5 : 0;
    const sponsorsSec = Math.max(sponsorsCfgSec, partnerCycleSec);

    // Cena focus dura o suficiente para mostrar cada destaque (carrossel).
    const focusSec = FOCUS_SCENE_SEC * Math.max(1, featuredGames.length);

    const durSec =
      cur === "sponsors"
        ? sponsorsSec
        : cur === "byte"
          ? BYTE_SCENE_SEC
          : cur === "focus"
            ? focusSec
            : mainSec;
    const t = setTimeout(
      () => setSceneIdx((i) => (i + 1) % list.length),
      durSec * 1000,
    );
    return () => clearTimeout(t);
  }, [
    sceneIdx,
    hasFocus,
    hasSponsors,
    nPartners,
    featuredGames.length,
    forceScene,
    data?.tournament.sceneDurations,
  ]);

  if (!data) {
    return (
      <Stage bg="main">
        <StatusOverlay state={statusFromError(error)} />
      </Stage>
    );
  }

  const scene: SceneName = scenes[sceneIdx % nScenes] ?? "main";
  return (
    <Stage bg={scene}>
      {scene === "sponsors" ? (
        <SponsorsScene data={data} />
      ) : scene === "byte" ? null : scene === "focus" ? (
        <FocusCarousel games={featuredGames} />
      ) : (
        <MainScene data={data} />
      )}
    </Stage>
  );
}

type SceneName = "main" | "focus" | "sponsors" | "byte";

/** Ordem de rotação das cenas, conforme o que há para mostrar. */
function buildScenes(hasFocus: boolean, hasSponsors: boolean): SceneName[] {
  const s: SceneName[] = ["main"];
  if (hasFocus) s.push("focus");
  if (hasSponsors) s.push("sponsors", "byte");
  return s;
}

/** Carrossel dos jogos em destaque dentro da cena focus (um por vez). */
function FocusCarousel({ games }: { games: CavaletteGame[] }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (games.length <= 1) return;
    const t = setTimeout(
      () => setIdx((i) => (i + 1) % games.length),
      FOCUS_SCENE_SEC * 1000,
    );
    return () => clearTimeout(t);
  }, [idx, games.length]);
  const game = games[idx % games.length];
  if (!game) return null;
  return <FocusScene game={game} />;
}

// =============================================================================
// STAGE — PNG do designer como background completo (header + dot field + arcs
// + título "EM JOGO AGORA" já incluído). Nada de CSS extra de decoração.
// =============================================================================
function Stage({
  children,
  bg,
}: {
  children: React.ReactNode;
  bg: SceneName;
}) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const update = () => {
      const sx = window.innerWidth / STAGE_W;
      const sy = window.innerHeight / STAGE_H;
      setScale(Math.min(sx, sy));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Cada cena tem o seu próprio PNG do designer com chrome completo
  // (header + títulos + caixas + footer). Código só desenha CONTEÚDO
  // DINÂMICO (logos, scores, jogadores) por cima.
  // A cena focus desenha o próprio fundo (gradiente) — não tem PNG.
  const bgFile =
    bg === "sponsors"
      ? "scene-sponsors-bg.png"
      : bg === "byte"
        ? "scene-byte.png"
        : bg === "focus"
          ? null
          : "scene-main-bg.png";
  // ?v= força o webview a ignorar a cópia em cache quando o PNG muda
  const bgUrl = bgFile ? `/cavalete/${bgFile}?v=${SCENE_ASSET_VERSION}` : null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: STAGE_W,
          height: STAGE_H,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: "center center",
          overflow: "hidden",
          color: "#fff",
          fontFamily: FONT_DISPLAY,
          backgroundColor: "#020817",
          backgroundImage: bgUrl ? `url('${bgUrl}')` : "none",
          backgroundSize: `${STAGE_W}px ${STAGE_H}px`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "0 0",
          transition: "background-image 0.5s ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// =============================================================================
// RELÓGIO — hora de Angola (Africa/Luanda), a contar ao vivo. Canto superior.
// =============================================================================
function CavaleteClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString("pt-PT", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "Africa/Luanda",
        }),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  if (!time) return null; // evita mismatch de hidratação (só renderiza no cliente)
  return (
    <div
      style={{
        position: "absolute",
        top: 40,
        left: 44,
        zIndex: 5,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 22px",
        borderRadius: 16,
        background: "rgba(2, 12, 36, .55)",
        border: `2px solid ${BLUE}`,
        boxShadow:
          "inset 0 0 16px rgba(45,140,255,.2), 0 0 18px rgba(45,140,255,.4)",
      }}
    >
      <ClockIcon size={34} color={CYAN} />
      <span
        style={{
          fontFamily: FONT_BODY,
          fontWeight: 800,
          fontSize: 46,
          color: "#fff",
          letterSpacing: "1px",
          fontVariantNumeric: "tabular-nums",
          textShadow: "0 0 12px rgba(45,140,255,.5)",
        }}
      >
        {time}
      </span>
    </div>
  );
}

// =============================================================================
// MAIN SCENE
// =============================================================================
function MainScene({ data }: { data: CavaletePayload }) {
  const [court1, court2] = data.cavalete.courts;
  const live1 = data.liveByCourt[0] ?? null;
  const live2 = data.liveByCourt[1] ?? null;

  return (
    <section
      style={{
        position: "relative",
        zIndex: 1,
        height: "100%",
        // padding-top = onde acaba o "EM JOGO AGORA" do PNG (cabeçalho
        // compacto acaba a ~481px no canvas 1920) + margem para o badge
        // "CAMPO XX" do card1 ficar abaixo
        padding: "520px 36px 4px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <CavaleteClock />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          marginBottom: 6,
        }}
      >
        {court1 && <LiveMatchCard court={court1} game={live1} />}
        {court2 && <LiveMatchCard court={court2} game={live2} />}
      </div>

      <SectionTitle>PRÓXIMOS JOGOS DE HOJE</SectionTitle>
      <div style={{ marginTop: 6, marginBottom: 8 }}>
        {data.upcoming.length === 0 ? (
          <EmptyHint>Sem mais jogos hoje</EmptyHint>
        ) : (
          <PaginatedList
            items={data.upcoming}
            pageSize={4}
            rowHeight={72}
            gap={6}
            keyFn={(g) => String(g.padelteamsId)}
            renderItem={(g) => <UpcomingRow game={g} />}
          />
        )}
      </div>

      <SectionTitle>RESULTADOS DE HOJE</SectionTitle>
      <div style={{ marginTop: 6 }}>
        {data.results.length === 0 ? (
          <EmptyHint>Sem resultados ainda</EmptyHint>
        ) : (
          <PaginatedList
            items={data.results}
            pageSize={3}
            rowHeight={72}
            gap={6}
            keyFn={(g) => String(g.padelteamsId)}
            renderItem={(g) => <ResultRow game={g} />}
          />
        )}
      </div>

      <div style={{ flex: 1 }} />
    </section>
  );
}

// =============================================================================
// SECTION TITLE (PRÓXIMOS / RESULTADOS) — replica o estilo do "EM JOGO
// AGORA" que vem dentro do PNG (linhas cyan/lime nos lados, white text)
// =============================================================================
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
      }}
    >
      <span
        style={{
          height: 3,
          width: 120,
          background: `linear-gradient(90deg, transparent, ${LIME})`,
          boxShadow: `0 0 12px ${LIME}`,
          borderRadius: 3,
        }}
      />
      <span
        style={{
          color: "#fff",
          fontSize: 44,
          letterSpacing: "2px",
          textShadow: `0 0 16px rgba(18, 200, 255, .55)`,
          whiteSpace: "nowrap",
        }}
      >
        {children}
      </span>
      <span
        style={{
          height: 3,
          width: 120,
          background: `linear-gradient(90deg, ${LIME}, transparent)`,
          boxShadow: `0 0 12px ${LIME}`,
          borderRadius: 3,
        }}
      />
    </div>
  );
}

// =============================================================================
// LIVE MATCH CARD
// =============================================================================
function LiveMatchCard({
  court,
  game,
}: {
  court: { id: string; name: string };
  game: CavaletteGame | null;
}) {
  return (
    <div style={{ position: "relative" }}>
      {/* Badge dentro do card no topo, sem overhang p/ não tapar título PNG */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 2,
        }}
      >
        <CourtBadge name={court.name} />
      </div>
      <div
        style={{
          border: `2px solid ${BLUE}`,
          borderRadius: 18,
          background: "rgba(2, 12, 36, .72)",
          boxShadow:
            "inset 0 0 30px rgba(45, 140, 255, .35), 0 0 35px rgba(45, 140, 255, .55)",
          padding: "42px 24px 8px",
          minHeight: 150,
        }}
      >
        {game ? <LiveMatchContent game={game} /> : <AwaitingNext />}
      </div>
    </div>
  );
}

function CourtBadge({ name }: { name: string }) {
  return (
    <div
      style={{
        background: LIME,
        color: "#001a1a",
        fontFamily: FONT_BODY,
        fontWeight: 900,
        fontSize: 24,
        letterSpacing: "2px",
        padding: "5px 22px",
        clipPath:
          "polygon(7px 0, calc(100% - 7px) 0, 100% 50%, calc(100% - 7px) 100%, 7px 100%, 0 50%)",
      }}
    >
      CAMPO {name.toUpperCase()}
    </div>
  );
}

function LiveMatchContent({ game }: { game: CavaletteGame }) {
  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          gap: 18,
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <TeamColumn team={game.teamA} label="DUPLA A" />
        <BigVS />
        <TeamColumn team={game.teamB} label="DUPLA B" />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 2px 1fr",
          alignItems: "center",
          gap: 18,
          paddingTop: 12,
          borderTop: `1px solid rgba(45, 140, 255, .4)`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            justifyContent: "center",
            color: CYAN,
            fontFamily: FONT_BODY,
            fontWeight: 800,
            fontSize: 28,
            letterSpacing: "1.5px",
          }}
        >
          <ClockIcon size={28} color={CYAN} />
          <span style={{ color: "#fff" }}>INÍCIO {formatTime(game.startsAt)}</span>
        </div>
        <div
          style={{
            width: 2,
            height: 36,
            background:
              "linear-gradient(180deg, transparent, rgba(45,140,255,.5), transparent)",
          }}
        />
        <div style={{ display: "flex", justifyContent: "center" }}>
          <StatusPill game={game} />
        </div>
      </div>
    </>
  );
}

function TeamColumn({
  team,
  label,
}: {
  team: CavaletteTeam;
  label: string;
}) {
  const names = (team.players.length > 0
    ? team.players.map((p) => p.name)
    : [team.name]
  ).slice(0, 2);
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          color: CYAN,
          fontFamily: FONT_BODY,
          fontWeight: 800,
          fontSize: 18,
          letterSpacing: "2px",
          marginBottom: 4,
          textShadow: "0 0 12px rgba(18, 200, 255, .55)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: "#fff",
          fontSize: 36,
          lineHeight: 1.05,
          letterSpacing: "1px",
          textShadow: "0 0 16px rgba(255,255,255,.35)",
        }}
      >
        {names.map((n, i) => (
          <div key={i}>{n}</div>
        ))}
      </div>
    </div>
  );
}

function BigVS() {
  return (
    <div
      style={{
        color: LIME,
        fontSize: 90,
        lineHeight: 0.85,
        fontStyle: "italic",
        textShadow: `0 0 28px rgba(155,240,0,.85)`,
        padding: "0 4px",
      }}
    >
      VS
    </div>
  );
}

function StatusPill({ game }: { game: CavaletteGame }) {
  const last = game.sets[game.sets.length - 1];
  if (last) {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 12,
          color: CYAN,
          fontFamily: FONT_BODY,
          fontWeight: 900,
          fontSize: 28,
          letterSpacing: "1.5px",
          padding: "10px 26px",
          border: `2px solid ${CYAN}`,
          borderRadius: 999,
          background: "rgba(18, 200, 255, .08)",
          boxShadow: `0 0 18px rgba(18, 200, 255, .45)`,
        }}
      >
        SET {game.sets.length} · {last.a}-{last.b}
      </div>
    );
  }
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        color: "#fff",
        fontFamily: FONT_BODY,
        fontWeight: 900,
        fontSize: 28,
        letterSpacing: "1.5px",
        padding: "10px 26px",
        border: `2px solid ${RED}`,
        borderRadius: 999,
        background: "rgba(255, 69, 84, .12)",
        boxShadow: `0 0 18px rgba(255, 69, 84, .55)`,
      }}
    >
      <style>{`@keyframes cav-live-dot {0%,100%{opacity:1}50%{opacity:.35}}`}</style>
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: RED,
          boxShadow: `0 0 12px ${RED}`,
          animation: "cav-live-dot 1.2s ease-in-out infinite",
        }}
      />
      AO VIVO
    </div>
  );
}

function AwaitingNext() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: "30px 0",
      }}
    >
      <ClockIcon size={64} color={CYAN} />
      <div
        style={{
          color: "#fff",
          fontSize: 56,
          letterSpacing: "2px",
          textShadow: `0 0 14px rgba(18, 200, 255, .55)`,
        }}
      >
        AGUARDA PRÓXIMO JOGO
      </div>
    </div>
  );
}

// =============================================================================
// UPCOMING ROW
// =============================================================================
function UpcomingRow({ game }: { game: CavaletteGame }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "110px 190px minmax(0, 1fr) 60px minmax(0, 1fr) 36px",
        alignItems: "center",
        gap: 12,
        height: "100%",
        boxSizing: "border-box",
        padding: "10px 16px",
        border: `2px solid ${BLUE}`,
        borderRadius: 14,
        background: "rgba(2, 12, 36, .68)",
        boxShadow:
          "inset 0 0 18px rgba(45, 140, 255, .25), 0 0 14px rgba(45, 140, 255, .35)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: "#fff",
          fontFamily: FONT_BODY,
          fontWeight: 800,
          fontSize: 22,
        }}
      >
        <ClockIcon size={20} color={CYAN} />
        {formatTime(game.startsAt)}
      </div>
      <div>
        <CompactPill name={game.court?.name ?? "?"} />
      </div>
      <CompactTeam team={game.teamA} align="left" />
      <div
        style={{
          color: LIME,
          fontSize: 28,
          fontStyle: "italic",
          textAlign: "center",
          textShadow: `0 0 14px rgba(155, 240, 0, .7)`,
        }}
      >
        VS
      </div>
      <CompactTeam team={game.teamB} align="right" />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 2,
          opacity: 0.55,
        }}
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <span
            key={i}
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: BLUE,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// RESULT ROW
// =============================================================================
function ResultRow({ game }: { game: CavaletteGame }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "110px 190px minmax(0, 1fr) 50px minmax(0, 1fr) 180px",
        alignItems: "center",
        gap: 10,
        height: "100%",
        boxSizing: "border-box",
        padding: "10px 14px",
        border: `2px solid ${BLUE}`,
        borderRadius: 14,
        background: "rgba(2, 12, 36, .68)",
        boxShadow:
          "inset 0 0 18px rgba(45, 140, 255, .25), 0 0 14px rgba(45, 140, 255, .35)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: "#fff",
          fontFamily: FONT_BODY,
          fontWeight: 800,
          fontSize: 22,
        }}
      >
        <ClockIcon size={20} color={CYAN} />
        {formatTime(game.startsAt)}
      </div>
      <div>
        <CompactPill name={game.court?.name ?? "?"} />
      </div>
      <CompactTeam team={game.teamA} align="left" dimmed={game.winner === 2} />
      <div
        style={{
          color: LIME,
          fontSize: 24,
          fontStyle: "italic",
          textAlign: "center",
          textShadow: `0 0 12px rgba(155, 240, 0, .6)`,
        }}
      >
        VS
      </div>
      <CompactTeam team={game.teamB} align="right" dimmed={game.winner === 1} />
      <div
        style={{
          color: CYAN,
          fontFamily: FONT_BODY,
          fontWeight: 900,
          fontSize: 24,
          textAlign: "right",
          letterSpacing: "0.8px",
          textShadow: `0 0 14px rgba(18, 200, 255, .55)`,
          whiteSpace: "nowrap",
        }}
      >
        {game.scoreLabel ?? "—"}
      </div>
    </div>
  );
}

function CompactPill({ name }: { name: string }) {
  return (
    <div
      style={{
        display: "inline-block",
        maxWidth: "100%",
        boxSizing: "border-box",
        background: LIME,
        color: "#001a1a",
        fontFamily: FONT_BODY,
        fontWeight: 900,
        fontSize: 16,
        letterSpacing: "0.3px",
        padding: "5px 12px",
        // nome do campo SEMPRE numa linha — senão "STANDARD BANK" quebra em 2
        // e empurra a altura da row, sobrepondo a secção seguinte
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        clipPath:
          "polygon(6px 0, calc(100% - 6px) 0, 100% 50%, calc(100% - 6px) 100%, 6px 100%, 0 50%)",
      }}
    >
      {name.toUpperCase()}
    </div>
  );
}

function CompactTeam({
  team,
  align,
  dimmed = false,
}: {
  team: CavaletteTeam;
  align: "left" | "right";
  dimmed?: boolean;
}) {
  const names = (team.players.length > 0
    ? team.players.map((p) => p.name)
    : [team.name]
  ).slice(0, 2);
  return (
    <div
      style={{
        color: dimmed ? "rgba(255,255,255,.45)" : "#fff",
        fontFamily: FONT_BODY,
        fontWeight: dimmed ? 600 : 700,
        fontSize: 22,
        letterSpacing: "0.3px",
        textAlign: align,
        textTransform: "uppercase",
        lineHeight: 1.1,
      }}
    >
      {names.map((n, i) => (
        <div
          key={i}
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {n}
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// SPONSORS SCENE — sobre o PNG scene-sponsors-bg.png do designer
//
// O PNG já tem TODO o chrome visual desenhado:
//   - Header padel Open
//   - Título "PATROCINADORES OFICIAIS" + caixa branca grande vazia
//   - Título "NOSSOS PARCEIROS" + grid 3×2 de caixinhas vazias
//   - Footer ornament
//
// O código só posiciona LOGOS dinâmicos por cima das caixas.
// Coordenadas em canvas 1080×1920 (PNG 941×1672 é esticado pelo Stage).
// =============================================================================
// Coordenadas medidas directamente do scene-sponsors-bg.png (1080×1920)
// via detecção de pixels brancos nas caixas desenhadas.
const SPONSORS_LAYOUT = {
  // Caixa grande "PATROCINADORES OFICIAIS" — grid 4×2 de logos
  mainCard: {
    x: 48,
    y: 620,
    w: 987,
    h: 585,
    grid: { cols: 4, rows: 2, padding: 36, gap: 16 },
  },
  // 6 caixinhas em grid 3×2 — 1 logo cada
  partnersGrid: {
    startX: 64,
    startY: 1330,
    cellW: 303,
    cellH: 195,
    gapX: 22,
    gapY: 40,
    cols: 3,
    rows: 2,
  },
};

// Imagem única (opcional) dos PATROCINADORES OFICIAIS — substitui o grid de
// logos. Basta colocar o ficheiro em public/cavalete/logopatrocinadores.png
// (proporção ~1.47, a caixa branca). Se não existir, usa-se o grid 4×2 normal.
const OFFICIALS_IMG = "/cavalete/logopatrocinadores.png";
// Interior BRANCO da caixa (dentro das linhas azuis, medido no PNG:
// x 54..1029, y 618..1207) com folga para a moldura azul respirar à volta.
const OFFICIALS_BOX = { x: 66, y: 630, w: 948, h: 566 };

// =============================================================================
// FOCUS SCENE — cartaz de DESTAQUE/finais sobre os PNGs do designer.
//   FinalSresultado.png  → "PRÓXIMO JOGO" (mostra horário)
//   FinalCresultado.png  → "RESULTADO EM ANDAMENTO" (mostra pontuação)
// O PNG traz todo o chrome (logo, molduras, VS, tabela); o código só
// posiciona fotos, nomes e números nas zonas medidas (canvas 1080×1920).
// =============================================================================

// Zonas medidas no FinalSresultado (próximo jogo).
// As molduras de cima (A) são mais ALTAS que as de baixo (B) no PNG, por isso
// as fotos usam todas a MESMA altura (a da moldura B) e ficam alinhadas pela
// BASE de cada moldura — assim os jogadores aparecem todos do mesmo tamanho.
const FOCUS_PHOTO_H = 384;
const FOCUS_S = {
  bg: "FinalSresultado.png",
  // caixa no topo (entre as molduras de cima) → nome do campo
  campo: { x: 392, y: 354, w: 296, h: 42 },
  photoA: [
    { x: 152, y: 895 - FOCUS_PHOTO_H, w: 348, h: FOCUS_PHOTO_H },
    { x: 580, y: 895 - FOCUS_PHOTO_H, w: 348, h: FOCUS_PHOTO_H },
  ],
  nameA: [
    { x: 152, y: 922, w: 348, h: 132 },
    { x: 580, y: 922, w: 348, h: 132 },
  ],
  photoB: [
    { x: 152, y: 1557 - FOCUS_PHOTO_H, w: 348, h: FOCUS_PHOTO_H },
    { x: 580, y: 1557 - FOCUS_PHOTO_H, w: 348, h: FOCUS_PHOTO_H },
  ],
  nameB: [
    { x: 152, y: 1560, w: 348, h: 120 },
    { x: 580, y: 1560, w: 348, h: 120 },
  ],
  horario: { cx: 540, y: 1740, w: 470, h: 130 },
};

function FocusPhotoAbs({
  zone,
  url,
}: {
  zone: { x: number; y: number; w: number; h: number };
  url: string | null;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: zone.x,
        top: zone.y,
        width: zone.w,
        height: zone.h,
        overflow: "hidden",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 2,
      }}
    >
      {url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={url}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <svg viewBox="0 0 100 122" style={{ width: "60%", opacity: 0.4 }}>
          <circle cx="50" cy="34" r="21" fill={BLUE} />
          <path
            d="M50 58 C26 58 15 82 13 122 L87 122 C85 82 74 58 50 58 Z"
            fill={BLUE}
          />
        </svg>
      )}
    </div>
  );
}

function FocusName({
  zone,
  name,
}: {
  zone: { x: number; y: number; w: number; h: number };
  name: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: zone.x,
        top: zone.y,
        width: zone.w,
        height: zone.h,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 14px",
        boxSizing: "border-box",
        textAlign: "center",
        color: "#fff",
        fontFamily: FONT_DISPLAY,
        fontSize: 52,
        lineHeight: 1.0,
        letterSpacing: "1px",
        textTransform: "uppercase",
        zIndex: 3,
      }}
    >
      {name}
    </div>
  );
}

// Zonas medidas no FinalCresultado (resultado em andamento). As molduras são
// mais baixas porque a tabela de pontuação ocupa o centro.
const FOCUS_C = {
  bg: "FinalCresultado.png",
  // molduras A (630..895) e B (1400..1660) têm a mesma altura → fotos preenchem
  photoA: [
    { x: 120, y: 630, w: 350, h: 265 },
    { x: 590, y: 630, w: 350, h: 265 },
  ],
  nameA: [
    { x: 120, y: 928, w: 350, h: 70 },
    { x: 590, y: 928, w: 350, h: 70 },
  ],
  photoB: [
    { x: 120, y: 1400, w: 350, h: 260 },
    { x: 590, y: 1400, w: 350, h: 260 },
  ],
  nameB: [
    { x: 120, y: 1665, w: 350, h: 56 },
    { x: 590, y: 1665, w: 350, h: 56 },
  ],
  // caixa ao lado de "AO VIVO" → nome do campo
  campo: { x: 360, y: 410, w: 360, h: 62 },
  // tabela: x-centros das 4 colunas de dados e y-centros das 2 linhas
  table: {
    cols: [390, 544, 686, 872], // SETS | 1º SET | 2º SET | PONTOS
    rowA: 1147,
    rowB: 1243,
  },
};

type LiveScore = NonNullable<CavaletteGame["liveScore"]>;

/** Números da pontuação ao vivo, posicionados nas células da tabela do PNG. */
function FocusTable({ score }: { score: LiveScore }) {
  const T = FOCUS_C.table;
  const rowA = [
    String(score.setsA),
    score.gamesA[0] ?? "—",
    score.gamesA[1] ?? "—",
    score.pointsA,
  ];
  const rowB = [
    String(score.setsB),
    score.gamesB[0] ?? "—",
    score.gamesB[1] ?? "—",
    score.pointsB,
  ];
  const cell = (cx: number, cy: number, val: string | number, lime: boolean) => (
    <div
      key={`${cx}-${cy}`}
      style={{
        position: "absolute",
        left: cx - 70,
        top: cy - 34,
        width: 140,
        height: 68,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: lime ? LIME : "#fff",
        fontFamily: FONT_DISPLAY,
        fontSize: 50,
        fontVariantNumeric: "tabular-nums",
        zIndex: 3,
      }}
    >
      {val}
    </div>
  );
  return (
    <>
      {T.cols.map((cx, i) => cell(cx, T.rowA, rowA[i], i === 3))}
      {T.cols.map((cx, i) => cell(cx, T.rowB, rowB[i], i === 3))}
    </>
  );
}

function FocusScene({ game }: { game: CavaletteGame }) {
  // Com marcador a correr → cartaz "RESULTADO EM ANDAMENTO"; senão → "PRÓXIMO".
  const live = game.liveScore;
  const L = live ? FOCUS_C : FOCUS_S;
  const a = game.teamA.players;
  const b = game.teamB.players;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 1,
        backgroundImage: `url('/cavalete/${L.bg}?v=${SCENE_ASSET_VERSION}')`,
        backgroundSize: `${STAGE_W}px ${STAGE_H}px`,
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* fotos + nomes Dupla A */}
      {L.photoA.map((z, i) => (
        <FocusPhotoAbs key={"pa" + i} zone={z} url={a[i]?.photoUrl ?? null} />
      ))}
      {L.nameA.map((z, i) => (
        <FocusName key={"na" + i} zone={z} name={a[i]?.name ?? ""} />
      ))}

      {/* fotos + nomes Dupla B */}
      {L.photoB.map((z, i) => (
        <FocusPhotoAbs key={"pb" + i} zone={z} url={b[i]?.photoUrl ?? null} />
      ))}
      {L.nameB.map((z, i) => (
        <FocusName key={"nb" + i} zone={z} name={b[i]?.name ?? ""} />
      ))}

      {game.court?.name ? (
        <div
          style={{
            position: "absolute",
            left: L.campo.x,
            top: L.campo.y,
            width: L.campo.w,
            height: L.campo.h,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontFamily: FONT_DISPLAY,
            fontSize: Math.round(L.campo.h * 0.66),
            letterSpacing: "1px",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            zIndex: 3,
          }}
        >
          {game.court.name}
        </div>
      ) : null}

      {live ? (
        <FocusTable score={live} />
      ) : (
        /* horário (variante PRÓXIMO JOGO) */
        <div
          style={{
            position: "absolute",
            left: FOCUS_S.horario.cx - FOCUS_S.horario.w / 2,
            top: FOCUS_S.horario.y,
            width: FOCUS_S.horario.w,
            height: FOCUS_S.horario.h,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontFamily: FONT_DISPLAY,
            fontSize: 96,
            letterSpacing: "3px",
            fontVariantNumeric: "tabular-nums",
            zIndex: 3,
          }}
        >
          {formatTime(game.startsAt)}
        </div>
      )}
    </div>
  );
}

function SponsorsScene({ data }: { data: CavaletePayload }) {
  const mainSponsors = data.sponsors.fullscreen.slice(0, 8); // até 8 no grid 4×2
  const partnerPool = data.sponsors.footer;
  // Tenta a imagem única; se o ficheiro não existir (404), cai no grid de logos.
  const [officialsImgFailed, setOfficialsImgFailed] = useState(false);

  // Construir 6 listas DISJUNTAS (uma por slot do grid 3×2) usando
  // chunking por stride: o slot i recebe pool[i], pool[i+6], pool[i+12]...
  // Garante que num dado instante NUNCA há logos repetidos visíveis,
  // mesmo com pools grandes (ex: 16 → cada slot tem 2-3 logos exclusivos).
  const partnerSlotItems: { imageUrl: string }[][] = Array.from(
    { length: 6 },
    () => [],
  );
  partnerPool.forEach((item, idx) => {
    partnerSlotItems[idx % 6]!.push(item);
  });

  return (
    <>
      {/* PATROCINADORES OFICIAIS — imagem única se existir, senão grid 4×2 */}
      {officialsImgFailed ? (
        <MainSponsorsCard
          slot={SPONSORS_LAYOUT.mainCard}
          sponsors={mainSponsors}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={OFFICIALS_IMG}
          alt=""
          onError={() => setOfficialsImgFailed(true)}
          style={{
            position: "absolute",
            left: OFFICIALS_BOX.x,
            top: OFFICIALS_BOX.y,
            width: OFFICIALS_BOX.w,
            height: OFFICIALS_BOX.h,
            objectFit: "contain",
            zIndex: 2,
          }}
        />
      )}

      {/* GRID 3×2 de logos parceiros — POR CIMA das 6 caixinhas do PNG */}
      {Array.from({ length: 6 }).map((_, i) => {
        const col = i % SPONSORS_LAYOUT.partnersGrid.cols;
        const row = Math.floor(i / SPONSORS_LAYOUT.partnersGrid.cols);
        const x =
          SPONSORS_LAYOUT.partnersGrid.startX +
          col * (SPONSORS_LAYOUT.partnersGrid.cellW + SPONSORS_LAYOUT.partnersGrid.gapX);
        const y =
          SPONSORS_LAYOUT.partnersGrid.startY +
          row * (SPONSORS_LAYOUT.partnersGrid.cellH + SPONSORS_LAYOUT.partnersGrid.gapY);
        return (
          <PartnerCard
            key={i}
            x={x}
            y={y}
            w={SPONSORS_LAYOUT.partnersGrid.cellW}
            h={SPONSORS_LAYOUT.partnersGrid.cellH}
            items={partnerSlotItems[i]!}
            rotateMs={PARTNER_ROTATE_MS + i * PARTNER_STAGGER_MS}
          />
        );
      })}
    </>
  );
}

// -----------------------------------------------------------------------------
// EmptySlotPlaceholder — placeholder discreto para slots vazios no grid
// 4×2 do PATROCINADOR OFICIAL (usado em preview / quando há menos de 8
// patrocinadores configurados)
// -----------------------------------------------------------------------------
function EmptySlotPlaceholder({ label }: { label: string }) {
  return (
    <div
      style={{
        border: "2px dashed rgba(45, 140, 255, .25)",
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(45, 140, 255, .55)",
        fontFamily: FONT_BODY,
        fontWeight: 700,
        fontSize: 14,
        letterSpacing: "1px",
        textAlign: "center",
        padding: 6,
      }}
    >
      {label}
    </div>
  );
}

// -----------------------------------------------------------------------------
// MainSponsorsCard — caixa branca grande com grid 4×2 de logos dentro
// -----------------------------------------------------------------------------
function MainSponsorsCard({
  slot,
  sponsors,
}: {
  slot: {
    x: number;
    y: number;
    w: number;
    h: number;
    grid: { cols: number; rows: number; padding: number; gap: number };
  };
  sponsors: { imageUrl: string }[];
}) {
  const cells = slot.grid.cols * slot.grid.rows; // 8
  const list = Array.from({ length: cells }).map((_, i) => sponsors[i] ?? null);

  return (
    <div
      style={{
        // POR CIMA da caixa branca desenhada no PNG (sem styling próprio)
        position: "absolute",
        left: slot.x,
        top: slot.y,
        width: slot.w,
        height: slot.h,
        zIndex: 2,
        padding: slot.grid.padding,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${slot.grid.cols}, 1fr)`,
          gridTemplateRows: `repeat(${slot.grid.rows}, 1fr)`,
          gap: slot.grid.gap,
          width: "100%",
          height: "100%",
        }}
      >
        {list.map((item, i) =>
          item ? (
            <div
              key={i}
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {/* Logo ocupa 95% × 75% da célula (mantendo aspect ratio via
                  background-size: contain). Generoso o suficiente para
                  logos com aspects extremos não desaparecerem, sem ficarem
                  todos a tocar nas bordas. */}
              <div
                style={{
                  width: "95%",
                  height: "75%",
                  backgroundImage: `url('${item.imageUrl}')`,
                  backgroundPosition: "center",
                  backgroundSize: "contain",
                  backgroundRepeat: "no-repeat",
                }}
              />
            </div>
          ) : (
            <EmptySlotPlaceholder key={i} label="Patrocinador" />
          ),
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// PartnerCard — caixinha branca com cyan glow border, com 1 logo dentro,
// rotaciona entre items
// -----------------------------------------------------------------------------
function PartnerCard({
  x,
  y,
  w,
  h,
  items,
  rotateMs,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  items: { imageUrl: string }[];
  rotateMs: number;
}) {
  const [idx, setIdx] = useState(0);
  const total = items.length;

  useEffect(() => {
    if (total <= 1) return;
    const t = setTimeout(() => setIdx((i) => (i + 1) % total), rotateMs);
    return () => clearTimeout(t);
  }, [idx, total, rotateMs]);

  return (
    <div
      style={{
        // POR CIMA da caixinha branca desenhada no PNG (sem styling próprio)
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        overflow: "hidden",
        zIndex: 2,
      }}
    >
      {total === 0 ? (
        <div
          style={{
            position: "absolute",
            inset: 16,
            border: "2px dashed rgba(45, 140, 255, .35)",
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(45, 140, 255, .65)",
            fontFamily: FONT_BODY,
            fontWeight: 700,
            fontSize: 18,
            letterSpacing: "1px",
          }}
        >
          PARCEIRO
        </div>
      ) : (
        items.map((item, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              opacity: i === idx ? 1 : 0,
              transition: `opacity ${PARTNER_FADE_MS}ms ease`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Área alvo fixa 230×150 — uniformiza weight visual entre
                logos com aspect ratios diferentes */}
            <div
              style={{
                width: 230,
                height: 150,
                backgroundImage: `url('${item.imageUrl}')`,
                backgroundPosition: "center",
                backgroundSize: "contain",
                backgroundRepeat: "no-repeat",
              }}
            />
          </div>
        ))
      )}
    </div>
  );
}

// =============================================================================
// PAGINATED LIST — rota entre páginas se houver mais items do que cabem
// Crossfade de 0.6s entre páginas, 8s por página
// =============================================================================
const PAGE_HOLD_MS = 8000;
const PAGE_FADE_MS = 600;

function PaginatedList<T>({
  items,
  pageSize,
  rowHeight,
  gap,
  keyFn,
  renderItem,
}: {
  items: T[];
  pageSize: number;
  rowHeight: number; // altura aproximada de cada row, p/ reservar espaço fixo
  gap: number;
  keyFn: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
}) {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += pageSize) {
    pages.push(items.slice(i, i + pageSize));
  }
  const totalPages = pages.length;
  const [pageIdx, setPageIdx] = useState(0);

  useEffect(() => {
    if (totalPages <= 1) return;
    const t = setTimeout(
      () => setPageIdx((i) => (i + 1) % totalPages),
      PAGE_HOLD_MS,
    );
    return () => clearTimeout(t);
  }, [pageIdx, totalPages]);

  // Reservar altura fixa = pageSize rows + (pageSize-1) gaps
  const containerHeight = pageSize * rowHeight + (pageSize - 1) * gap;

  return (
    <div>
      <div style={{ position: "relative", height: containerHeight }}>
        {pages.map((page, i) => {
          const isActive = i === pageIdx;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                gap,
                opacity: isActive ? 1 : 0,
                transition: `opacity ${PAGE_FADE_MS}ms ease`,
                pointerEvents: isActive ? "auto" : "none",
              }}
            >
              {page.map((item) => (
                // altura fixa por row — garante que o conteúdo nunca transborda
                // o espaço reservado e invade a secção seguinte
                <div
                  key={keyFn(item)}
                  style={{ height: rowHeight, overflow: "hidden" }}
                >
                  {renderItem(item)}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {totalPages > 1 && <PageDots count={totalPages} active={pageIdx} />}
    </div>
  );
}

function PageDots({ count, active }: { count: number; active: number }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        justifyContent: "center",
        marginTop: 8,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          style={{
            width: i === active ? 18 : 8,
            height: 8,
            borderRadius: 4,
            background: i === active ? CYAN : "rgba(255,255,255,.25)",
            boxShadow: i === active ? `0 0 8px ${CYAN}` : "none",
            transition: "all .3s ease",
          }}
        />
      ))}
    </div>
  );
}

// =============================================================================
// UTILS
// =============================================================================
function formatTime(iso: string): string {
  // Sempre na hora de Angola (Africa/Luanda, UTC+1) — independente do fuso
  // do kiosk/servidor. Senão um kiosk mal configurado mostraria horas erradas.
  return new Date(iso).toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Africa/Luanda",
  });
}

function ClockIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
      <path
        d="M12 7 V12 L15.5 14"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "20px 22px",
        border: `2px dashed rgba(45, 140, 255, .35)`,
        borderRadius: 14,
        color: "rgba(255,255,255,.45)",
        fontFamily: FONT_BODY,
        fontWeight: 700,
        fontSize: 22,
        textAlign: "center",
        letterSpacing: "1px",
      }}
    >
      {children}
    </div>
  );
}

// =============================================================================
// STATUS OVERLAY — para estados de erro/loading, dentro do Stage
// Mantém o header padel Open do PNG visível por baixo, em vez de tela negra.
// =============================================================================
type StatusKind = "loading" | "notfound" | "unconfigured" | "offline" | "server" | "network";
interface StatusInfo {
  kind: StatusKind;
  title: string;
  hint: string;
  emoji: string;
  color: string;
}

function statusFromError(err: FetchError | null): StatusInfo {
  if (!err) {
    return {
      kind: "loading",
      title: "A PREPARAR CAVALETE",
      hint: "A carregar dados do torneio...",
      emoji: "⏳",
      color: "#12c8ff",
    };
  }
  if (err.status === 404) {
    return {
      kind: "notfound",
      title: "CAVALETE NÃO ENCONTRADO",
      hint: "Verifica se o código do dispositivo está correcto. Contacta o organizador se persistir.",
      emoji: "🔍",
      color: "#ff4554",
    };
  }
  if (err.status === 409) {
    return {
      kind: "unconfigured",
      title: "AGUARDANDO CONFIGURAÇÃO",
      hint:
        err.hint ||
        "O torneio ainda não está ligado ao PadelTeams. Vai começar em breve.",
      emoji: "⚙",
      color: "#9bf000",
    };
  }
  if (err.status === 502) {
    return {
      kind: "offline",
      title: "SEM LIGAÇÃO AO PADELTEAMS",
      hint: "A tentar reconectar automaticamente...",
      emoji: "📡",
      color: "#ffaa00",
    };
  }
  if (err.status >= 500) {
    return {
      kind: "server",
      title: "ERRO TEMPORÁRIO",
      hint: `Servidor indisponível (${err.status}). A tentar novamente...`,
      emoji: "⚠",
      color: "#ff4554",
    };
  }
  if (err.status === 0) {
    return {
      kind: "network",
      title: "SEM LIGAÇÃO À REDE",
      hint: "Verifica a ligação Wi-Fi/Ethernet deste cavalete.",
      emoji: "📶",
      color: "#ffaa00",
    };
  }
  // Fallback para outros 4xx
  return {
    kind: "server",
    title: `ERRO ${err.status}`,
    hint: err.hint || err.rawMessage || "Erro desconhecido — a tentar novamente.",
    emoji: "⚠",
    color: "#ff4554",
  };
}

function StatusOverlay({ state }: { state: StatusInfo }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        // Não cobre o header padel Open do PNG (top ~430px)
        paddingTop: 720,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        textAlign: "center",
        padding: "720px 60px 0",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          fontSize: 120,
          marginBottom: 30,
          textShadow: `0 0 40px ${state.color}`,
          opacity: state.kind === "loading" ? 0.85 : 1,
          animation:
            state.kind === "loading"
              ? "cav-pulse 1.8s ease-in-out infinite"
              : undefined,
        }}
      >
        {state.emoji}
      </div>
      <style>{`@keyframes cav-pulse {0%,100%{opacity:.4;transform:scale(.96)}50%{opacity:1;transform:scale(1.04)}}`}</style>
      <div
        style={{
          color: state.color,
          fontSize: 72,
          letterSpacing: "3px",
          textShadow: `0 0 24px ${state.color}99`,
          marginBottom: 24,
          lineHeight: 1.1,
        }}
      >
        {state.title}
      </div>
      <div
        style={{
          color: "rgba(255,255,255,.78)",
          fontFamily: FONT_BODY,
          fontWeight: 600,
          fontSize: 32,
          maxWidth: 820,
          lineHeight: 1.35,
        }}
      >
        {state.hint}
      </div>
    </div>
  );
}
