"use client";

import { useEffect, useRef, useState } from "react";

// ============================================================================
// TYPES — mirroring /api/totem/[token]
// ============================================================================
interface Player {
  name: string;
  shortName: string | null;
  photoUrl: string | null;
}
interface MatchData {
  id: string;
  status: string;
  scheduledAt: string | null;
  teamA: { p1: Player | null; p2: Player | null };
  teamB: { p1: Player | null; p2: Player | null };
}
interface Sponsor {
  imageUrl: string;
  durationSec?: number;
}
interface TotemPayload {
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
// CONSTANTS
// ============================================================================
const POLL_INTERVAL_MS = 15_000;
const MAIN_SCENE_MS = 20_000;
const TOTEM_W = 192;
const TOTEM_H = 640;
const CYAN = "#00baff";
const LIME = "#baff00";

// Efeitos reutilizáveis (porto das classes neon-blue, neon-green, glows do HTML)
const NEON_BLUE: React.CSSProperties = {
  background:
    "linear-gradient(180deg, rgba(5, 28, 75, .92), rgba(1, 9, 30, .96))",
  border: `1px solid ${CYAN}`,
  boxShadow:
    "0 0 3px rgba(0, 186, 255, .95), 0 0 10px rgba(0, 186, 255, .70), 0 0 18px rgba(0, 90, 255, .35), inset 0 0 12px rgba(0, 160, 255, .28)",
};
const NEON_GREEN: React.CSSProperties = {
  background:
    "linear-gradient(180deg, rgba(6, 22, 24, .94), rgba(1, 8, 24, .98))",
  border: `1px solid ${LIME}`,
  boxShadow:
    "0 0 4px rgba(186, 255, 0, .95), 0 0 12px rgba(186, 255, 0, .50), inset 0 0 12px rgba(186, 255, 0, .16)",
};
const GREEN_TEXT: React.CSSProperties = {
  color: LIME,
  textShadow:
    "0 0 4px rgba(186, 255, 0, .95), 0 0 12px rgba(186, 255, 0, .65)",
};
const WHITE_GLOW: React.CSSProperties = {
  textShadow:
    "0 0 4px rgba(255,255,255,.75), 0 0 9px rgba(0,170,255,.42)",
};

// ============================================================================
// TotemView — polling + cycler
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
        <div style={{ color: "#f87171", padding: 24, textAlign: "center" }}>
          Erro: {error}
        </div>
      </Stage>
    );
  }
  if (!data) {
    return (
      <Stage>
        <div style={{ color: "#94a3b8", padding: 24 }}>A carregar...</div>
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
// Stage — replica do .poster do HTML, com background + textura + light waves
// ============================================================================
function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        background: "#000",
      }}
    >
      <div
        style={{
          width: TOTEM_W,
          height: TOTEM_H,
          transform: "scale(min(calc(100vh / 640), calc(100vw / 192)))",
          transformOrigin: "center center",
          flexShrink: 0,
          position: "relative",
          overflow: "hidden",
          color: "#fff",
          // Background: 3 radial + linear gradient (igual ao HTML)
          background:
            "radial-gradient(circle at 50% 18%, rgba(0, 132, 255, .58), transparent 28%), radial-gradient(circle at 50% 44%, rgba(0, 90, 220, .42), transparent 34%), radial-gradient(circle at 50% 72%, rgba(0, 180, 255, .18), transparent 26%), linear-gradient(180deg, #020814 0%, #041b4d 42%, #020816 100%)",
        }}
      >
        {/* ::before — textura de pontos azuis */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(rgba(0, 185, 255, .35) 1px, transparent 1px)",
            backgroundSize: "8px 8px",
            opacity: 0.18,
            zIndex: 1,
            pointerEvents: "none",
          }}
        />
        {/* ::after — linhas/ondas de luz diagonais */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(125deg, transparent 0%, rgba(0, 174, 255, .16) 44%, transparent 58%), linear-gradient(35deg, transparent 0%, rgba(186, 255, 0, .08) 48%, transparent 62%)",
            zIndex: 1,
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", zIndex: 2, width: "100%", height: "100%" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MainScene — TODOS os elementos com posicionamento ABSOLUTO pixel-perfect
// ============================================================================
function MainScene({ data }: { data: TotemPayload }) {
  return (
    <>
      <TopBrand tournament={data.tournament} />

      {/* CAMPO — empurrado para baixo para acomodar logo maior */}
      <div
        style={{
          position: "absolute",
          top: 160,
          left: 10,
          width: 172,
          height: 44,
          borderRadius: 7,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 30,
          fontWeight: 900,
          letterSpacing: "1.5px",
          ...NEON_BLUE,
          ...WHITE_GLOW,
        }}
      >
        {data.court.toUpperCase()}
      </div>

      {data.currentMatch ? (
        <>
          {/* DUPLA A label */}
          <Label top={212}>DUPLA A</Label>
          {/* Players A */}
          <PlayersRow top={226} height={90} team={data.currentMatch.teamA} />
          {/* Names A */}
          <NamesBox top={318} team={data.currentMatch.teamA} />
          {/* VS */}
          <VsLabel top={368} />
          {/* DUPLA B label */}
          <Label top={406}>DUPLA B</Label>
          {/* Players B */}
          <PlayersRow top={420} height={90} team={data.currentMatch.teamB} />
          {/* Names B */}
          <NamesBox top={512} team={data.currentMatch.teamB} />
          {/* Time box */}
          {data.currentMatch.scheduledAt && (
            <TimeBox scheduledAt={data.currentMatch.scheduledAt} />
          )}
        </>
      ) : (
        <NoMatch />
      )}

      {/* Next box — top: 579 */}
      {/* NextBox só aparece se NÃO houver TimeBox (não há scheduled_at no
          current match) — espaço vertical é escasso, prioriza HORÁRIO.
          Para mostrar o próximo jogo sempre, é melhor passar a uma cena
          separada no cycler (TODO). */}
      {data.nextMatch &&
        !(data.currentMatch && data.currentMatch.scheduledAt) && (
          <NextBox match={data.nextMatch} />
        )}

      {/* Sponsors — bottom: 4 */}
      <SponsorsRow sponsors={data.sponsors.footer} />
    </>
  );
}

// ============================================================================
// TOP BRAND (logo + textos no top)
// ============================================================================
function TopBrand({
  tournament,
}: {
  tournament: TotemPayload["tournament"];
}) {
  if (!tournament) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        width: "100%",
        textAlign: "center",
      }}
    >
      {tournament.logoUrl ? (
        // Logo PNG do torneio — bump para encher o top do totem
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={tournament.logoUrl}
          alt=""
          style={{
            width: "98%",
            maxHeight: 145,
            objectFit: "contain",
            margin: "0 auto",
            display: "block",
            filter:
              "drop-shadow(0 0 5px rgba(0, 186, 255, .9)) drop-shadow(0 0 9px rgba(186, 255, 0, .28))",
          }}
        />
      ) : (
        // Fallback estilo mockup (sem logo PNG)
        <>
          <div
            style={{
              fontSize: 12,
              fontWeight: 900,
              lineHeight: 0.9,
              letterSpacing: "0.3px",
              ...WHITE_GLOW,
            }}
          >
            {tournament.name.toUpperCase()}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// LABEL DUPLA A/B
// ============================================================================
function Label({ top, children }: { top: number; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        top,
        width: "100%",
        textAlign: "center",
        fontSize: 13,
        fontWeight: 900,
        letterSpacing: "3px",
        ...GREEN_TEXT,
      }}
    >
      {children}
    </div>
  );
}

// ============================================================================
// PLAYERS ROW (2 jogadores lado a lado, com glow azul por baixo)
// ============================================================================
function PlayersRow({
  top,
  height,
  team,
}: {
  top: number;
  height: number;
  team: { p1: Player | null; p2: Player | null };
}) {
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 7,
        width: 178,
        height,
        display: "flex",
        justifyContent: "center",
        gap: 2,
      }}
    >
      <PlayerCell player={team.p1} />
      {team.p2 && <PlayerCell player={team.p2} />}
    </div>
  );
}

function PlayerCell({ player }: { player: Player | null }) {
  return (
    <div
      style={{
        width: 88,
        height: "100%",
        position: "relative",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        overflow: "visible",
      }}
    >
      {/* Glow blob azul por baixo (::before) */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          width: 78,
          height: 72,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(0, 186, 255, .65), transparent 68%)",
          filter: "blur(4px)",
          zIndex: 0,
        }}
      />
      {player?.photoUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={player.photoUrl}
          alt=""
          style={{
            position: "relative",
            zIndex: 2,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            objectPosition: "bottom center",
            filter:
              "drop-shadow(0 0 4px rgba(0, 186, 255, .95)) drop-shadow(0 6px 7px rgba(0,0,0,.75))",
          }}
        />
      ) : (
        <div
          style={{
            position: "relative",
            zIndex: 2,
            color: "rgba(255,255,255,.5)",
            fontSize: 30,
            paddingBottom: 8,
          }}
        >
          ?
        </div>
      )}
    </div>
  );
}

// ============================================================================
// NAMES BOX
// ============================================================================
function NamesBox({
  top,
  team,
}: {
  top: number;
  team: { p1: Player | null; p2: Player | null };
}) {
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 10,
        width: 172,
        height: 48,
        borderRadius: 7,
        textAlign: "center",
        paddingTop: 6,
        ...NEON_BLUE,
      }}
    >
      {team.p1 && (
        <NameLine name={team.p1.name} short={team.p1.shortName} />
      )}
      {team.p2 && (
        <NameLine name={team.p2.name} short={team.p2.shortName} />
      )}
    </div>
  );
}

function NameLine({ name, short }: { name: string; short: string | null }) {
  return (
    <div
      style={{
        fontSize: 18,
        fontWeight: 900,
        lineHeight: 1.08,
        letterSpacing: "0.2px",
        ...WHITE_GLOW,
      }}
    >
      {short ?? name}
    </div>
  );
}

// ============================================================================
// VS
// ============================================================================
function VsLabel({ top }: { top: number }) {
  return (
    <div
      style={{
        position: "absolute",
        top,
        width: "100%",
        textAlign: "center",
        fontSize: 42,
        fontWeight: 900,
        fontStyle: "italic",
        lineHeight: 0.9,
        ...GREEN_TEXT,
      }}
    >
      VS
    </div>
  );
}

// ============================================================================
// TIME BOX (HORÁRIO DO JOGO)
// ============================================================================
function TimeBox({ scheduledAt }: { scheduledAt: string }) {
  const d = new Date(scheduledAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return (
    <div
      style={{
        position: "absolute",
        top: 568,
        left: 10,
        width: 172,
        height: 42,
        borderRadius: 8,
        textAlign: "center",
        ...NEON_GREEN,
      }}
    >
      <div
        style={{
          marginTop: 3,
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: "1.2px",
          ...GREEN_TEXT,
        }}
      >
        HORÁRIO DO JOGO
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 900,
          lineHeight: 0.95,
          color: "#fff",
          textShadow:
            "0 0 5px rgba(255,255,255,.9), 0 0 12px rgba(186,255,0,.45)",
        }}
      >
        {time}
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
    <div
      style={{
        position: "absolute",
        top: 568,
        left: 10,
        width: 172,
        height: 42,
        borderRadius: 7,
        textAlign: "center",
        paddingTop: 3,
        ...NEON_BLUE,
      }}
    >
      <div
        style={{
          fontSize: 8,
          fontWeight: 900,
          color: CYAN,
          letterSpacing: "1px",
          textShadow: "0 0 8px rgba(0,186,255,.8)",
        }}
      >
        A SEGUIR
      </div>
      <div
        style={{
          fontSize: 7,
          fontWeight: 900,
          lineHeight: 1.05,
        }}
      >
        {pa1}
        {pa2}
      </div>
      <div
        style={{
          fontSize: 7,
          fontWeight: 900,
          color: LIME,
          lineHeight: 1,
        }}
      >
        VS
      </div>
      <div
        style={{
          fontSize: 7,
          fontWeight: 900,
          lineHeight: 1.05,
        }}
      >
        {pb1}
        {pb2}
      </div>
    </div>
  );
}

// ============================================================================
// SPONSORS ROW (3-col grid, cada um com neon-blue subtil)
// ============================================================================
function SponsorsRow({ sponsors }: { sponsors: Sponsor[] }) {
  const cols = sponsors.length === 0 ? 1 : sponsors.length;
  return (
    <div
      style={{
        position: "absolute",
        left: 6,
        bottom: 4,
        width: 180,
        height: 26,
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 3,
      }}
    >
      {sponsors.length === 0 ? (
        <div
          style={{
            borderRadius: 4,
            background: "rgba(0, 4, 16, .88)",
            border: "1px solid rgba(0, 186, 255, .35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 6,
            color: "rgba(255,255,255,.3)",
          }}
        >
          —
        </div>
      ) : (
        sponsors.map((s, i) => (
          <div
            key={i}
            style={{
              borderRadius: 4,
              background: "rgba(0, 4, 16, .88)",
              border: "1px solid rgba(0, 186, 255, .35)",
              boxShadow:
                "0 0 5px rgba(0, 186, 255, .35), inset 0 0 8px rgba(0, 80, 170, .25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 2,
              overflow: "hidden",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.imageUrl}
              alt=""
              style={{
                maxWidth: "94%",
                maxHeight: 20,
                objectFit: "contain",
              }}
            />
          </div>
        ))
      )}
    </div>
  );
}

// ============================================================================
// EMPTY + FULLSCREEN
// ============================================================================
function NoMatch() {
  return (
    <div
      style={{
        position: "absolute",
        top: 200,
        left: 0,
        right: 0,
        textAlign: "center",
        padding: "30px 14px",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 800,
          color: "#94a3b8",
          letterSpacing: "1.5px",
          marginBottom: 6,
        }}
      >
        SEM JOGO ACTUAL
      </div>
      <div style={{ fontSize: 10, color: "#64748b" }}>
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
