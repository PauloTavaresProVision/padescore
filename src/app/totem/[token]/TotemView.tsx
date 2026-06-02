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
// POLLING constants
// ============================================================================
const POLL_INTERVAL_MS = 15_000; // 15s — relativamente rápido p/ ver mudanças
const MAIN_SCENE_MS = 20_000; // 20s entre cada rotação para fullscreen

// Native pixels do design
const TOTEM_W = 192;
const TOTEM_H = 640;

// ============================================================================
// TotemView — polling + cycler + render
// ============================================================================
export function TotemView({ token }: { token: string }) {
  const [data, setData] = useState<TotemPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const etagRef = useRef<string | null>(null);

  // ----- POLLING -----
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
        if (res.status === 304) return; // nothing changed
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

  // ----- CYCLER (main scene → fullscreen sponsor → main → next sponsor...) -----
  const [cycleIdx, setCycleIdx] = useState(0);
  const fsCount = data?.sponsors.fullscreen.length ?? 0;
  useEffect(() => {
    if (fsCount === 0) return; // sem fullscreen, fica sempre na main
    const next = () => setCycleIdx((i) => (i + 1) % (fsCount + 1));
    // cycleIdx == 0 → main scene; >=1 → sponsor[i-1]
    const dur =
      cycleIdx === 0
        ? MAIN_SCENE_MS
        : (data?.sponsors.fullscreen[cycleIdx - 1]?.durationSec ?? 8) * 1000;
    const t = setTimeout(next, dur);
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

  // Cena fullscreen do sponsor?
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
          // Escala para encher a altura disponível (ou largura se for portrait extremo)
          transform: "scale(min(calc(100vh / 640), calc(100vw / 192)))",
          transformOrigin: "center center",
          flexShrink: 0,
          position: "relative",
          overflow: "hidden",
          background:
            "radial-gradient(ellipse 70% 50% at 50% 30%, #1d3a8a 0%, transparent 70%), radial-gradient(ellipse 80% 40% at 50% 85%, #0d2670 0%, transparent 75%), linear-gradient(180deg, #050d24 0%, #08163a 50%, #050d24 100%)",
          boxShadow: "0 22px 60px rgba(0,0,0,.7)",
        }}
      >
        {/* dots pattern overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(rgba(56,189,248,.06) 1px, transparent 1px)",
            backgroundSize: "6px 6px",
            pointerEvents: "none",
          }}
        />
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// MainScene — o layout principal do totem
// ============================================================================
function MainScene({ data }: { data: TotemPayload }) {
  return (
    <div
      style={{
        position: "relative",
        zIndex: 2,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "6px 0 0",
      }}
    >
      {/* HEADER MARCA */}
      <BrandHeader tournament={data.tournament} />

      {/* COURT PILL */}
      <div
        style={{
          margin: "6px 6px 4px",
          padding: "12px 0",
          textAlign: "center",
          background:
            "linear-gradient(180deg, rgba(13,40,80,.6) 0%, rgba(5,20,50,.6) 100%)",
          borderRadius: 7,
          border: "2px solid rgba(56,189,248,.9)",
          boxShadow:
            "0 0 16px rgba(56,189,248,.65), inset 0 0 12px rgba(56,189,248,.2)",
          fontSize: 28,
          fontWeight: 900,
          letterSpacing: "3px",
          color: "#fff",
          textShadow: "0 0 8px rgba(255,255,255,.4)",
        }}
      >
        {data.court.toUpperCase()}
      </div>

      {data.currentMatch ? (
        <>
          <TeamBlock label="DUPLA A" team={data.currentMatch.teamA} />
          <VsBig />
          <TeamBlock label="DUPLA B" team={data.currentMatch.teamB} />
          <ScheduledBlock scheduledAt={data.currentMatch.scheduledAt} />
        </>
      ) : (
        <NoMatch />
      )}

      {/* A SEGUIR */}
      {data.nextMatch ? (
        <NextBlock match={data.nextMatch} />
      ) : (
        <div style={{ flex: 1 }} />
      )}

      {/* FOOTER SPONSORS */}
      <FooterSponsors sponsors={data.sponsors.footer} />
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================
function BrandHeader({
  tournament,
}: {
  tournament: TotemPayload["tournament"];
}) {
  if (!tournament) return null;
  return (
    <div style={{ textAlign: "center", padding: "8px 4px 2px" }}>
      {tournament.logoUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={tournament.logoUrl}
          alt=""
          style={{
            width: "98%",
            maxHeight: 150,
            objectFit: "contain",
            margin: "0 auto",
            display: "block",
          }}
        />
      ) : (
        <div
          style={{
            fontSize: 18,
            fontWeight: 900,
            color: "#fff",
            textTransform: "uppercase",
            padding: "24px 4px",
          }}
        >
          {tournament.name}
        </div>
      )}
    </div>
  );
}

function TeamBlock({
  label,
  team,
}: {
  label: string;
  team: { p1: Player | null; p2: Player | null };
}) {
  return (
    <div style={{ margin: "6px 6px 0", textAlign: "center" }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontSize: 14,
          fontWeight: 900,
          color: "#84cc16",
          letterSpacing: "2.5px",
          marginBottom: 4,
          textShadow: "0 0 6px rgba(132,204,22,.4)",
        }}
      >
        <span
          style={{
            width: 24,
            height: 2,
            background: "#84cc16",
            boxShadow: "0 0 6px rgba(132,204,22,.7)",
          }}
        />
        {label}
        <span
          style={{
            width: 24,
            height: 2,
            background: "#84cc16",
            boxShadow: "0 0 6px rgba(132,204,22,.7)",
          }}
        />
      </div>

      {/* Fotos: ABERTAS no fundo azul (sem caixa cinzenta atrás) */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 0,
          height: 140,
          width: "100%",
        }}
      >
        <PlayerThumb player={team.p1} />
        {team.p2 && <PlayerThumb player={team.p2} />}
      </div>

      {/* Nomes em pill com border cyan + glow */}
      <div
        style={{
          marginTop: 4,
          padding: "9px 6px",
          background:
            "linear-gradient(180deg, rgba(13,40,80,.7) 0%, rgba(5,15,40,.7) 100%)",
          border: "1.5px solid rgba(56,189,248,.7)",
          borderRadius: 7,
          fontSize: 16,
          fontWeight: 900,
          color: "#fff",
          lineHeight: 1.2,
          letterSpacing: "0.5px",
          boxShadow:
            "0 0 10px rgba(56,189,248,.35), inset 0 0 8px rgba(56,189,248,.1)",
          textTransform: "uppercase",
        }}
      >
        {team.p1 && <div>{team.p1.shortName ?? team.p1.name}</div>}
        {team.p2 && <div>{team.p2.shortName ?? team.p2.name}</div>}
      </div>
    </div>
  );
}

function PlayerThumb({ player }: { player: Player | null }) {
  return (
    <div
      style={{
        width: 90,
        height: 140,
        position: "relative",
        flexShrink: 0,
        display: "grid",
        placeItems: "end center",
      }}
    >
      {player?.photoUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={player.photoUrl}
          alt=""
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            objectPosition: "bottom",
          }}
        />
      ) : (
        // Sem foto: silhueta minimalista no fundo azul, sem caixa
        <div
          style={{
            width: 70,
            height: 120,
            opacity: 0.25,
            display: "grid",
            placeItems: "end center",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#fff",
              marginBottom: 60,
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: 60,
              height: 70,
              background: "#fff",
              borderRadius: "20px 20px 0 0",
            }}
          />
        </div>
      )}
    </div>
  );
}

function VsBig() {
  return (
    <div
      style={{
        textAlign: "center",
        fontSize: 44,
        fontWeight: 900,
        color: "#84cc16",
        lineHeight: 1,
        margin: "6px 0 4px",
        textShadow:
          "0 0 14px rgba(132,204,22,.85), 0 0 32px rgba(132,204,22,.4)",
        letterSpacing: "3px",
        fontStyle: "italic",
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: 36,
          height: 2,
          background: "rgba(132,204,22,.7)",
          verticalAlign: "middle",
          margin: "0 7px",
          boxShadow: "0 0 6px rgba(132,204,22,.6)",
        }}
      />
      VS
      <span
        style={{
          display: "inline-block",
          width: 36,
          height: 2,
          background: "rgba(132,204,22,.7)",
          verticalAlign: "middle",
          margin: "0 7px",
          boxShadow: "0 0 6px rgba(132,204,22,.6)",
        }}
      />
    </div>
  );
}

function ScheduledBlock({ scheduledAt }: { scheduledAt: string | null }) {
  if (!scheduledAt) return <div style={{ height: 6 }} />;
  const d = new Date(scheduledAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return (
    <div
      style={{
        margin: "10px 6px 4px",
        padding: "8px 4px 10px",
        background:
          "linear-gradient(180deg, rgba(13,40,80,.7) 0%, rgba(5,15,40,.7) 100%)",
        borderRadius: 6,
        border: "1px solid #84cc16",
        boxShadow:
          "0 0 10px rgba(132,204,22,.35), inset 0 0 6px rgba(132,204,22,.08)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 900,
          color: "#84cc16",
          letterSpacing: "1.8px",
          marginBottom: 4,
          textShadow: "0 0 6px rgba(132,204,22,.4)",
        }}
      >
        HORÁRIO DO JOGO
      </div>
      <div
        style={{
          fontSize: 46,
          fontWeight: 900,
          color: "#fff",
          letterSpacing: "3.5px",
          lineHeight: 1,
          textShadow: "0 0 12px rgba(255,255,255,.55)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {time}
      </div>
    </div>
  );
}

function NextBlock({ match }: { match: MatchData }) {
  const pa1 = match.teamA.p1?.shortName ?? match.teamA.p1?.name ?? "?";
  const pa2 = match.teamA.p2 ? ` | ${match.teamA.p2.shortName ?? match.teamA.p2.name}` : "";
  const pb1 = match.teamB.p1?.shortName ?? match.teamB.p1?.name ?? "?";
  const pb2 = match.teamB.p2 ? ` | ${match.teamB.p2.shortName ?? match.teamB.p2.name}` : "";
  return (
    <div
      style={{
        margin: "6px 6px 4px",
        padding: "6px 4px 7px",
        background:
          "linear-gradient(180deg, rgba(5,15,40,.7) 0%, rgba(5,15,40,.5) 100%)",
        borderRadius: 6,
        border: "1px solid rgba(56,189,248,.45)",
        boxShadow:
          "0 0 8px rgba(56,189,248,.18), inset 0 0 6px rgba(56,189,248,.06)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 900,
          color: "#38bdf8",
          letterSpacing: "1.8px",
          marginBottom: 4,
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 14,
            height: 1.5,
            background: "#38bdf8",
            boxShadow: "0 0 4px rgba(56,189,248,.6)",
            verticalAlign: "middle",
            margin: "0 4px",
          }}
        />
        A SEGUIR
        <span
          style={{
            display: "inline-block",
            width: 14,
            height: 1.5,
            background: "#38bdf8",
            boxShadow: "0 0 4px rgba(56,189,248,.6)",
            verticalAlign: "middle",
            margin: "0 4px",
          }}
        />
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: "#fff",
          lineHeight: 1.25,
          textTransform: "uppercase",
        }}
      >
        {pa1}
        {pa2}
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 900,
          color: "#84cc16",
          lineHeight: 1.2,
          margin: "2px 0",
          textShadow: "0 0 4px rgba(132,204,22,.5)",
        }}
      >
        VS
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: "#fff",
          lineHeight: 1.25,
          textTransform: "uppercase",
        }}
      >
        {pb1}
        {pb2}
      </div>
    </div>
  );
}

function FooterSponsors({ sponsors }: { sponsors: Sponsor[] }) {
  return (
    <div
      style={{
        marginTop: "auto",
        padding: "6px 4px 8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-evenly",
        gap: 4,
        borderTop: "1px solid rgba(56,189,248,.2)",
        background: "rgba(255,255,255,.05)",
      }}
    >
      {sponsors.length === 0 ? (
        <span style={{ fontSize: 8, color: "rgba(255,255,255,.3)" }}>—</span>
      ) : (
        sponsors.map((s, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              minWidth: 0,
              height: 26,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "2px 2px",
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

// ============================================================================
// FullscreenSponsorScene — sponsor a cobrir o totem inteiro
// ============================================================================
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
