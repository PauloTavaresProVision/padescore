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
const STAGE_W = 1080;
const STAGE_H = 1920;
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

  // Rotação entre cenas: Main (40s) → Sponsors (15s) → Main → ...
  // Se não houver sponsors, fica sempre na Main.
  const hasSponsors =
    (data?.sponsors.footer.length ?? 0) +
      (data?.sponsors.fullscreen.length ?? 0) >
    0;
  // Em dev/teste, ?scene=sponsors força a Cena 3 (sem rotação)
  const url = typeof window !== "undefined" ? new URL(window.location.href) : null;
  const forceScene = url?.searchParams.get("scene");
  const [sceneIdx, setSceneIdx] = useState(0); // 0=main, 1=sponsors
  useEffect(() => {
    if (forceScene === "sponsors") {
      setSceneIdx(1);
      return;
    }
    if (forceScene === "main") {
      setSceneIdx(0);
      return;
    }
    if (!hasSponsors) return;
    const isMain = sceneIdx === 0;
    // Durações vêm do payload (configuradas por torneio no admin).
    // Defaults aplicados pelo servidor: 40s main / 15s sponsors.
    const mainSec = data?.tournament.sceneDurations.mainSec ?? 40;
    const sponsorsSec = data?.tournament.sceneDurations.sponsorsSec ?? 15;
    const dur = (isMain ? mainSec : sponsorsSec) * 1000;
    const t = setTimeout(() => setSceneIdx((i) => (i + 1) % 2), dur);
    return () => clearTimeout(t);
  }, [sceneIdx, hasSponsors, forceScene, data?.tournament.sceneDurations]);

  if (!data) {
    return (
      <Stage bg="main">
        <StatusOverlay state={statusFromError(error)} />
      </Stage>
    );
  }

  const showSponsors = hasSponsors && sceneIdx === 1;
  return (
    <Stage bg={showSponsors ? "sponsors" : "main"}>
      {showSponsors ? <SponsorsScene data={data} /> : <MainScene data={data} />}
    </Stage>
  );
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
  bg: "main" | "sponsors";
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
  const bgUrl =
    bg === "sponsors"
      ? "/cavalete/scene-sponsors-bg.png"
      : "/cavalete/scene-main-bg.png";

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
          backgroundImage: `url('${bgUrl}')`,
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
const PARTNER_ROTATE_MS = 6000;
const PARTNER_FADE_MS = 600;

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

function SponsorsScene({ data }: { data: CavaletePayload }) {
  const mainSponsors = data.sponsors.fullscreen.slice(0, 8); // até 8 no grid 4×2
  const partnerPool = data.sponsors.footer;

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
      {/* GRID 4×2 dos sponsors principais — POR CIMA da caixa branca do PNG */}
      <MainSponsorsCard
        slot={SPONSORS_LAYOUT.mainCard}
        sponsors={mainSponsors}
      />

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
            rotateMs={PARTNER_ROTATE_MS + i * 400}
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
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
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
