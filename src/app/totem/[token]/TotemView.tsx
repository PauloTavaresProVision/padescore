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
// CONSTANTS — exactly como no HTML do user
// ============================================================================
const POLL_INTERVAL_MS = 15_000;
const MAIN_SCENE_MS = 20_000;

const TOTEM_W = 192;
const TOTEM_H = 640;

// Cores exactas do mockup
const CYAN = "#00aaff";
const LIME = "#b8ff00";

// ============================================================================
// TotemView — polling + cycler + render
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

  // Cycler entre cena principal e sponsors fullscreen
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

  // Cena fullscreen do sponsor
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
// Stage — wraps the totem in a fullscreen viewport, scales to fit
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
          fontFamily: "Arial, Helvetica, sans-serif",
          // Background EXACTAMENTE como no mockup
          background:
            "radial-gradient(circle at top, rgba(0, 110, 255, 0.35), transparent 35%), linear-gradient(180deg, #061b45 0%, #020814 100%)",
          border: `1px solid rgba(0, 170, 255, 0.45)`,
        }}
      >
        {/* Overlay ::before do mockup */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, transparent 0%, rgba(0, 120, 255, 0.18) 50%, transparent 100%), radial-gradient(circle at 50% 40%, rgba(0, 132, 255, 0.25), transparent 35%)",
            pointerEvents: "none",
          }}
        />
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// MainScene — porto exacto do HTML do mockup
// ============================================================================
function MainScene({ data }: { data: TotemPayload }) {
  return (
    <div
      style={{
        position: "relative",
        zIndex: 2,
        padding: "8px 8px 6px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <BrandLogo tournament={data.tournament} />

      {/* FIELD (CAMPO) */}
      <div
        style={{
          width: "100%",
          height: 42,
          border: `1px solid ${CYAN}`,
          borderRadius: 6,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          margin: "6px 0 7px",
          background: "rgba(0, 15, 40, 0.65)",
          boxShadow: "0 0 12px rgba(0, 145, 255, 0.7)",
          fontSize: 22,
          fontWeight: 900,
          letterSpacing: 1,
        }}
      >
        {data.court.toUpperCase()}
      </div>

      {data.currentMatch ? (
        <>
          <TeamBlock label="DUPLA A" team={data.currentMatch.teamA} />
          <Vs />
          <TeamBlock label="DUPLA B" team={data.currentMatch.teamB} />
          {data.currentMatch.scheduledAt && (
            <TimeBox scheduledAt={data.currentMatch.scheduledAt} />
          )}
        </>
      ) : (
        <NoMatch />
      )}

      {data.nextMatch && <NextBox match={data.nextMatch} />}

      {/* Spacer empurra o footer para baixo se sobrar espaço */}
      <div style={{ flex: 1, minHeight: 0 }} />

      <FooterSponsors sponsors={data.sponsors.footer} />
    </div>
  );
}

// ============================================================================
// BRAND LOGO — usa a logo PNG do torneio, com altura limitada
// ============================================================================
function BrandLogo({
  tournament,
}: {
  tournament: TotemPayload["tournament"];
}) {
  if (!tournament) return null;
  return (
    <div
      style={{
        textAlign: "center",
        lineHeight: 1,
        marginBottom: 6,
        width: "100%",
      }}
    >
      {tournament.logoUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={tournament.logoUrl}
          alt=""
          style={{
            maxWidth: "100%",
            maxHeight: 110,
            objectFit: "contain",
            margin: "0 auto",
            display: "block",
          }}
        />
      ) : (
        // Fallback estilo mockup quando não há logo PNG
        <div>
          <div
            style={{
              width: 28,
              height: 28,
              margin: "0 auto 3px",
              border: "2px solid #fff",
              borderRadius: "7px 7px 10px 10px",
              background: "linear-gradient(135deg, #0ab8ff, #003a9c)",
              boxShadow: "0 0 10px rgba(0, 145, 255, 0.8)",
            }}
          />
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.5px" }}>
            {tournament.name.toUpperCase()}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TEAM BLOCK — label + 2 players + names box
// ============================================================================
function TeamBlock({
  label,
  team,
}: {
  label: string;
  team: { p1: Player | null; p2: Player | null };
}) {
  return (
    <>
      <div
        style={{
          color: LIME,
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: "3px",
          margin: "2px 0 4px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          width: "100%",
          height: 82,
          display: "flex",
          justifyContent: "center",
          gap: 5,
          overflow: "hidden",
        }}
      >
        <PlayerCell player={team.p1} />
        {team.p2 && <PlayerCell player={team.p2} />}
      </div>

      <div
        style={{
          width: "100%",
          border: `1px solid ${CYAN}`,
          borderRadius: 6,
          padding: "6px 4px",
          marginTop: 4,
          background: "rgba(0, 10, 30, 0.75)",
          boxShadow: "0 0 10px rgba(0, 145, 255, 0.55)",
          textAlign: "center",
        }}
      >
        {team.p1 && <NameLine text={team.p1.name} short={team.p1.shortName} />}
        {team.p2 && <NameLine text={team.p2.name} short={team.p2.shortName} />}
      </div>
    </>
  );
}

function NameLine({ text, short }: { text: string; short: string | null }) {
  // Usa o nome curto se existir (cabe melhor)
  return (
    <div
      style={{
        fontSize: 14,
        fontWeight: 900,
        lineHeight: 1.15,
        textTransform: "uppercase",
      }}
    >
      {short ?? text}
    </div>
  );
}

function PlayerCell({ player }: { player: Player | null }) {
  return (
    <div
      style={{
        width: 78,
        height: 82,
        background: "rgba(255, 255, 255, 0.08)",
        borderRadius: "6px 6px 0 0",
        overflow: "hidden",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        boxShadow: "0 0 18px rgba(0, 132, 255, 0.4)",
      }}
    >
      {player?.photoUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={player.photoUrl}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "top center",
          }}
        />
      ) : (
        <div
          style={{
            color: "rgba(255,255,255,.4)",
            fontSize: 24,
            paddingBottom: 20,
          }}
        >
          ?
        </div>
      )}
    </div>
  );
}

// ============================================================================
// VS
// ============================================================================
function Vs() {
  return (
    <div
      style={{
        fontSize: 32,
        fontWeight: 900,
        color: LIME,
        lineHeight: 1,
        margin: "6px 0 2px",
        textShadow: "0 0 14px rgba(184, 255, 0, 0.8)",
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
        width: "100%",
        marginTop: 8,
        border: `1px solid ${LIME}`,
        borderRadius: 7,
        background: "rgba(0, 10, 25, 0.85)",
        padding: "6px 4px 8px",
        textAlign: "center",
        boxShadow: "0 0 12px rgba(184, 255, 0, 0.35)",
      }}
    >
      <div
        style={{
          color: LIME,
          fontSize: 9,
          fontWeight: 900,
          letterSpacing: "1.5px",
          marginBottom: 2,
        }}
      >
        HORÁRIO DO JOGO
      </div>
      <div
        style={{
          fontSize: 42,
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: "-1px",
          textShadow: "0 0 10px rgba(255, 255, 255, 0.45)",
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
        width: "100%",
        marginTop: 8,
        border: `1px solid ${CYAN}`,
        borderRadius: 7,
        background: "rgba(0, 10, 25, 0.75)",
        padding: "6px 4px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          color: CYAN,
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: "1px",
          marginBottom: 4,
        }}
      >
        A SEGUIR
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          lineHeight: 1.2,
          textTransform: "uppercase",
        }}
      >
        {pa1}
        {pa2}
      </div>
      <div
        style={{
          color: LIME,
          fontSize: 11,
          fontWeight: 900,
          margin: "1px 0",
        }}
      >
        VS
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          lineHeight: 1.2,
          textTransform: "uppercase",
        }}
      >
        {pb1}
        {pb2}
      </div>
    </div>
  );
}

// ============================================================================
// FOOTER SPONSORS — grid 3-col com dividers
// ============================================================================
function FooterSponsors({ sponsors }: { sponsors: Sponsor[] }) {
  const cols = Math.max(1, sponsors.length);
  return (
    <div
      style={{
        marginTop: "auto",
        width: "100%",
        height: 34,
        border: "1px solid rgba(0, 170, 255, 0.45)",
        borderRadius: 5,
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        background: "rgba(0, 5, 18, 0.85)",
        overflow: "hidden",
      }}
    >
      {sponsors.length === 0 ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 7,
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
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 2,
              borderRight:
                i < sponsors.length - 1
                  ? "1px solid rgba(255, 255, 255, 0.25)"
                  : "none",
              overflow: "hidden",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.imageUrl}
              alt=""
              style={{
                maxHeight: "100%",
                maxWidth: "100%",
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
// EMPTY STATES + FULLSCREEN
// ============================================================================
function NoMatch() {
  return (
    <div
      style={{
        flex: 1,
        display: "grid",
        placeItems: "center",
        padding: "30px 14px",
      }}
    >
      <div style={{ textAlign: "center" }}>
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
    </div>
  );
}

function FullscreenSponsorScene({ imageUrl }: { imageUrl: string }) {
  return (
    <div
      style={{
        position: "relative",
        zIndex: 2,
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
