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
  tournament: { name: string };
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
export function CavaleteView({ token }: { token: string }) {
  const [data, setData] = useState<CavaletePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
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
          setError(`HTTP ${res.status}`);
          return;
        }
        const etag = res.headers.get("etag");
        if (etag) etagRef.current = etag;
        const json = (await res.json()) as CavaletePayload;
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

  if (!data) {
    return (
      <Stage>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            color: "#fff",
            fontSize: 32,
            fontFamily: FONT_BODY,
          }}
        >
          {error ? `Erro: ${error}` : "A carregar..."}
        </div>
      </Stage>
    );
  }

  return (
    <Stage>
      <MainScene data={data} />
    </Stage>
  );
}

// =============================================================================
// STAGE — PNG do designer como background completo (header + dot field + arcs
// + título "EM JOGO AGORA" já incluído). Nada de CSS extra de decoração.
// =============================================================================
function Stage({ children }: { children: React.ReactNode }) {
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
          backgroundImage: "url('/cavalete/scene-main-bg.png')",
          backgroundSize: `${STAGE_W}px ${STAGE_H}px`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "0 0",
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
        // padding-top = onde acaba o título "EM JOGO AGORA" do PNG (~440)
        // + 30px de margem para o badge "CAMPO XX" do card1 ficar abaixo
        padding: "720px 36px 6px",
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
          padding: "50px 24px 10px",
          minHeight: 160,
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
          fontSize: 24,
          letterSpacing: "2.5px",
          marginBottom: 6,
          textShadow: "0 0 12px rgba(18, 200, 255, .55)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: "#fff",
          fontSize: 50,
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
        fontSize: 130,
        lineHeight: 0.85,
        fontStyle: "italic",
        textShadow: `0 0 32px rgba(155,240,0,.85)`,
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
          "110px 160px minmax(0, 1fr) 60px minmax(0, 1fr) 36px",
        alignItems: "center",
        gap: 12,
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
          "110px 160px minmax(0, 1fr) 50px minmax(0, 1fr) 180px",
        alignItems: "center",
        gap: 10,
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
        background: LIME,
        color: "#001a1a",
        fontFamily: FONT_BODY,
        fontWeight: 900,
        fontSize: 22,
        letterSpacing: "1.5px",
        padding: "5px 14px",
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
                <div key={keyFn(item)}>{renderItem(item)}</div>
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
