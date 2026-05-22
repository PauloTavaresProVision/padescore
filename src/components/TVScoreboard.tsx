"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { applyEvent } from "@/lib/scoring/engine";
import { useReconnect } from "@/lib/use-reconnect";
import type { MatchConfig, MatchState as EngineMatchState } from "@/lib/scoring/types";

export interface TVMatch {
  id: string;
  court_name: string;
  category: string | null;
  team_a_player1: string;
  team_a_player2: string | null;
  team_b_player1: string;
  team_b_player2: string | null;
  team_a_photo_url: string | null;
  team_b_photo_url: string | null;
  status: "scheduled" | "live" | "finished";
  started_at: string | null;
  finished_at: string | null;
}

export interface TVTournament {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  tv_background_url: string | null;
  tv_standby_url?: string | null;
}

export interface TVState {
  points_a: string;
  points_b: string;
  games_a: number;
  games_b: number;
  sets_a: number;
  sets_b: number;
  sets_history: { a: number; b: number }[];
  server: "A" | "B";
  in_tiebreak: boolean;
  in_super_tiebreak: boolean;
  is_finished: boolean;
  winner: "A" | "B" | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  M1: "M1 OPEN MASCULINO",
  M2: "M2 OPEN MASCULINO",
  M3: "M3 OPEN MASCULINO",
  M4: "M4 OPEN MASCULINO",
  F1: "F1 OPEN FEMININO",
  F2: "F2 OPEN FEMININO",
  F3: "F3 OPEN FEMININO",
  F4: "F4 OPEN FEMININO",
};

export function TVScoreboard({
  match: initialMatch,
  tournament,
  config,
  initialState,
  forceWinner,
  forceStandby,
  initialElapsedSeconds,
}: {
  match: TVMatch;
  tournament: TVTournament;
  config: MatchConfig;
  initialState: TVState;
  /** Preview da celebração via ?celebrate=A|B (não afecta o jogo real). */
  forceWinner?: "A" | "B" | null;
  /** Preview do ecrã de espera via ?standby=1. */
  forceStandby?: boolean;
  /**
   * Tempo decorrido em segundos, calculado no SERVIDOR a cada request.
   * Garante que o relógio aparece logo no HTML inicial — sem depender do
   * JS do cliente arrancar. O JS, quando hidrata, assume o tick.
   */
  initialElapsedSeconds?: number | null;
}) {
  // match em estado → reactivo a edições do jogo (nomes, fotos, court,
  // categoria, status) sem refresh, via realtime na tabela `matches`.
  const [match, setMatch] = useState<TVMatch>(initialMatch);
  const [state, setState] = useState<TVState>(initialState);
  const [flashTeam, setFlashTeam] = useState<"A" | "B" | null>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Catch-up: o realtime perde mensagens durante quedas de rede. Quando
  // reconecta (ou o tab volta a ficar visível) volta a buscar o estado.
  const refetch = useCallback(async () => {
    const supabase = createClient();
    const [{ data: st }, { data: m }] = await Promise.all([
      supabase
        .from("match_state")
        .select("*")
        .eq("match_id", initialMatch.id)
        .single(),
      supabase
        .from("matches")
        .select(
          "court_name, category, team_a_player1, team_a_player2, team_b_player1, team_b_player2, team_a_photo_url, team_b_photo_url, status, started_at, finished_at",
        )
        .eq("id", initialMatch.id)
        .single(),
    ]);
    if (st) setState(st as unknown as TVState);
    if (m) {
      const row = m as Partial<TVMatch>;
      setMatch((prev) => ({
        ...prev,
        court_name: row.court_name ?? prev.court_name,
        category: row.category ?? null,
        team_a_player1: row.team_a_player1 ?? prev.team_a_player1,
        team_a_player2: row.team_a_player2 ?? null,
        team_b_player1: row.team_b_player1 ?? prev.team_b_player1,
        team_b_player2: row.team_b_player2 ?? null,
        team_a_photo_url: row.team_a_photo_url ?? null,
        team_b_photo_url: row.team_b_photo_url ?? null,
        status: row.status ?? prev.status,
        started_at: row.started_at ?? prev.started_at,
        finished_at: row.finished_at ?? prev.finished_at,
      }));
    }
  }, [initialMatch.id]);

  const { online, handleStatus } = useReconnect(refetch);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`tv:${match.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "match_state",
          filter: `match_id=eq.${match.id}`,
        },
        (payload) => {
          const next = payload.new as unknown as TVState;
          const prev = stateRef.current;
          const aChanged =
            next.points_a !== prev.points_a ||
            next.games_a !== prev.games_a ||
            next.sets_a !== prev.sets_a;
          const bChanged =
            next.points_b !== prev.points_b ||
            next.games_b !== prev.games_b ||
            next.sets_b !== prev.sets_b;
          if (aChanged && !bChanged) setFlashTeam("A");
          else if (bChanged && !aChanged) setFlashTeam("B");
          setState(next);
          if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
          flashTimeoutRef.current = setTimeout(() => setFlashTeam(null), 700);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${match.id}`,
        },
        (payload) => {
          const m = payload.new as Partial<TVMatch>;
          // Só os campos que a TV usa — ignora tokens/config interna.
          setMatch((prev) => ({
            ...prev,
            court_name: m.court_name ?? prev.court_name,
            category: m.category ?? null,
            team_a_player1: m.team_a_player1 ?? prev.team_a_player1,
            team_a_player2: m.team_a_player2 ?? null,
            team_b_player1: m.team_b_player1 ?? prev.team_b_player1,
            team_b_player2: m.team_b_player2 ?? null,
            team_a_photo_url: m.team_a_photo_url ?? null,
            team_b_photo_url: m.team_b_photo_url ?? null,
            status: m.status ?? prev.status,
            started_at: m.started_at ?? prev.started_at,
            finished_at: m.finished_at ?? prev.finished_at,
          }));
        },
      )
      .subscribe(handleStatus);
    return () => {
      supabase.removeChannel(channel);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, [match.id]);

  const hasProgress =
    state.points_a !== "0" ||
    state.points_b !== "0" ||
    state.games_a > 0 ||
    state.games_b > 0 ||
    state.sets_a > 0 ||
    state.sets_b > 0 ||
    state.sets_history.length > 0;

  // Golden point: 40-40 com a regra de golden point activa (morte súbita).
  const isGoldenPoint =
    config.goldenPoint &&
    !state.in_tiebreak &&
    !state.in_super_tiebreak &&
    state.points_a === "40" &&
    state.points_b === "40";
  const goldenStyle = isGoldenPoint
    ? {
        color: "#facc15",
        animation: "tv-score-golden 0.9s ease-in-out infinite",
      }
    : null;

  // Pré-jogo: TV ligada mas o jogo ainda não arrancou. Não mostra 0-0 —
  // mostra um ecrã de antevisão (fotos + nomes + "A COMEÇAR"). Sai daqui
  // assim que o primeiro ponto regista (hasProgress via realtime).
  const preMatch =
    match.status === "scheduled" && !hasProgress && !state.is_finished;

  // Celebração de fim de jogo. forceWinner (?celebrate=A|B) só para preview
  // (preview não expira). Num fim real, a celebração dura ~1 min e depois a
  // TV passa a um ecrã de espera até o operador pôr o próximo jogo.
  const previewing = !!forceWinner;
  const finishedWinner: "A" | "B" | null = state.is_finished
    ? state.winner
    : null;
  const [celebDone, setCelebDone] = useState(false);
  useEffect(() => {
    if (previewing || !finishedWinner) {
      setCelebDone(false);
      return;
    }
    const t = setTimeout(() => setCelebDone(true), 60_000);
    return () => clearTimeout(t);
  }, [previewing, finishedWinner]);

  const celebrateWinner: "A" | "B" | null = previewing
    ? forceWinner ?? null
    : finishedWinner && !celebDone
      ? finishedWinner
      : null;
  const standby =
    forceStandby || (!!finishedWinner && celebDone && !previewing);
  const [inferredStartedAt, setInferredStartedAt] = useState<string | null>(
    match.started_at,
  );
  useEffect(() => {
    if (inferredStartedAt) return;
    if (match.started_at) setInferredStartedAt(match.started_at);
    else if (hasProgress) setInferredStartedAt(new Date().toISOString());
  }, [hasProgress, inferredStartedAt, match.started_at]);

  const elapsed = useElapsedSeconds(
    inferredStartedAt,
    match.finished_at,
    initialElapsedSeconds ?? null,
  );
  const moment = useCriticalMoment(state, config);

  // Sets a mostrar: completos + corrente. Pad com "—" até 3.
  const completed = state.sets_history.map((s) => `${s.a}-${s.b}`);
  const setStrings: string[] = [...completed];
  if (!state.is_finished) setStrings.push(`${state.games_a}-${state.games_b}`);
  while (setStrings.length < 3) setStrings.push("—");

  const categoryLabel = match.category
    ? CATEGORY_LABELS[match.category] ?? match.category
    : "—";
  const elapsedStr = elapsed !== null ? formatElapsed(elapsed) : "—";

  // Texto da pill de serviço — moment se houver, senão "SERVIÇO: DUPLA X"
  let serviceText: string;
  let serviceIsAnimated = false;
  if (preMatch) {
    serviceText = "A COMEÇAR";
    serviceIsAnimated = true;
  } else if (state.is_finished) {
    serviceText = state.winner ? `VENCEDOR: DUPLA ${state.winner}` : "TERMINADO";
  } else if (moment) {
    serviceText =
      moment.team === "both"
        ? moment.label
        : `${moment.label} — DUPLA ${moment.team}`;
    serviceIsAnimated = true;
  } else {
    serviceText = `SERVIÇO: DUPLA ${state.server}`;
  }

  return (
    <>
      <style>{`
        .tv-body {
          position: fixed;
          inset: 0;
          margin: 0;
          background: #000;
          overflow: hidden;
        }
        .tv-stage {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          font-family: "Arial Narrow", "Roboto Condensed", Arial, sans-serif;
        }
        .tv-background {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: fill;
          user-select: none;
          pointer-events: none;
        }
        .tv-text {
          position: absolute;
          color: #fff;
          text-align: center;
          text-transform: uppercase;
          font-weight: 900;
          line-height: 1;
          text-shadow:
            0 0 12px rgba(255, 255, 255, 0.45),
            0 4px 12px rgba(0, 0, 0, 0.7);
          white-space: nowrap;
        }
        .tv-label {
          color: #33d5ff;
          margin-right: 0.45vw;
        }
        .tv-photo-slot {
          position: absolute;
          overflow: hidden;
          pointer-events: none;
        }
        .tv-photo-slot img {
          width: 100%;
          height: 100%;
          /* Composite tem fundo transparente — "contain" mantém a dupla inteira
             visível sem cortar braços/cabeças. */
          object-fit: contain;
          object-position: center bottom;
        }
        .tv-photo-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }
        .tv-photo-placeholder svg {
          width: 100%;
          height: 100%;
          filter: drop-shadow(0 0 14px rgba(66, 215, 255, 0.35));
        }

        /* === FOOTER === */
        .tv-footer {
          position: absolute;
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: #fff;
          text-transform: uppercase;
          font-weight: 900;
          line-height: 1;
          letter-spacing: 0.03em;
          text-shadow:
            0 0 12px rgba(255, 255, 255, 0.35),
            0 2px 8px rgba(0, 0, 0, 0.7);
        }
        .tv-footer-item {
          display: flex;
          align-items: center;
          gap: 0.7vw;
          flex: 1;
          justify-content: center;
          white-space: nowrap;
          min-width: 0;
        }
        /* Categoria costuma ser a label mais longa — dá-lhe mais espaço. */
        .tv-footer-item.tv-footer-cat { flex: 1.4; }
        .tv-footer-sep {
          display: inline-block;
          width: 1px;
          height: 2.2vw;
          background: linear-gradient(
            to bottom,
            transparent,
            rgba(66, 215, 255, 0.55) 30%,
            rgba(66, 215, 255, 0.55) 70%,
            transparent
          );
          flex-shrink: 0;
        }
        .tv-footer-item svg {
          width: 2vw;
          height: 2vw;
          color: #33d5ff;
          flex-shrink: 0;
          filter: drop-shadow(0 0 6px rgba(51, 213, 255, 0.45));
        }

        /* Score flash quando o ponto regista */
        @keyframes score-flash {
          0%   { color: #fff; text-shadow: 0 0 12px rgba(255,255,255,0.45), 0 4px 12px rgba(0,0,0,0.7); }
          30%  { color: #c4f600; text-shadow: 0 0 48px rgba(196,246,0,0.95), 0 0 96px rgba(196,246,0,0.5); }
          100% { color: #fff; text-shadow: 0 0 12px rgba(255,255,255,0.45), 0 4px 12px rgba(0,0,0,0.7); }
        }
        .tv-score-flash {
          animation: score-flash 700ms ease-out;
        }

        /* Pulse animado para momentos críticos */
        @keyframes moment-pulse {
          0%, 100% {
            color: #33d5ff;
            text-shadow: 0 0 12px rgba(51,213,255,0.45), 0 4px 12px rgba(0,0,0,0.7);
          }
          50% {
            color: #fff;
            text-shadow: 0 0 24px rgba(51,213,255,0.95), 0 0 48px rgba(51,213,255,0.6);
          }
        }
        .tv-moment-pulse {
          animation: moment-pulse 1100ms ease-in-out infinite;
        }

        /* === PRÉ-JOGO === */
        .tv-prematch-title {
          animation: tv-ambient 3.2s ease-in-out infinite;
        }
        @keyframes prematch-soon {
          0%, 100% {
            color: #fff;
            text-shadow:
              0 0 16px rgba(255, 255, 255, 0.5),
              0 0 40px rgba(66, 215, 255, 0.35),
              0 4px 12px rgba(0, 0, 0, 0.7);
            transform: translateX(-50%) scale(1);
          }
          50% {
            color: #c8f1ff;
            text-shadow:
              0 0 32px rgba(66, 215, 255, 0.95),
              0 0 72px rgba(66, 215, 255, 0.5),
              0 4px 12px rgba(0, 0, 0, 0.7);
            transform: translateX(-50%) scale(1.04);
          }
        }
        .tv-prematch-soon {
          animation: prematch-soon 2.4s ease-in-out infinite;
        }

        /* === ANIMAÇÕES AMBIENTE === */

        /* Respiração lenta dos accents cyan (JOGO, VS, DUPLA A/B, SETs, labels) */
        @keyframes tv-ambient {
          0%, 100% {
            text-shadow:
              0 0 8px rgba(66, 215, 255, 0.35),
              0 2px 6px rgba(0, 0, 0, 0.7);
          }
          50% {
            text-shadow:
              0 0 22px rgba(66, 215, 255, 0.85),
              0 0 44px rgba(66, 215, 255, 0.3),
              0 2px 6px rgba(0, 0, 0, 0.7);
          }
        }
        .tv-jogo, .tv-vs, .tv-dupla-a, .tv-dupla-b, .tv-set-label {
          animation: tv-ambient 4.5s ease-in-out infinite;
        }
        /* Pequeno desfasamento entre A e B para não pulsarem em uníssono */
        .tv-dupla-b { animation-delay: 2.25s; }
        .tv-set-label { animation-duration: 5.5s; }

        /* Respiração lenta dos números do score (entre flashes) */
        @keyframes tv-score-breathe {
          0%, 100% {
            text-shadow:
              0 0 12px rgba(255, 255, 255, 0.45),
              0 4px 12px rgba(0, 0, 0, 0.7);
          }
          50% {
            text-shadow:
              0 0 28px rgba(255, 255, 255, 0.7),
              0 0 56px rgba(66, 215, 255, 0.28),
              0 4px 12px rgba(0, 0, 0, 0.7);
          }
        }
        .tv-score-a, .tv-score-b {
          animation: tv-score-breathe 3.8s ease-in-out infinite;
        }
        .tv-score-b { animation-delay: 1.9s; }
        /* Flash override (mesmo nome de animação) — quando flasha, pára o breathe */
        .tv-score-flash {
          animation: score-flash 700ms ease-out !important;
        }
        /* Golden point (40-40): pontos amarelos a piscar */
        @keyframes tv-score-golden {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }

        /* Aura cyan nas fotos das duplas */
        @keyframes tv-photo-aura {
          0%, 100% {
            filter: drop-shadow(0 0 8px rgba(66, 215, 255, 0.15));
          }
          50% {
            filter: drop-shadow(0 0 28px rgba(66, 215, 255, 0.45))
                    drop-shadow(0 0 56px rgba(66, 215, 255, 0.15));
          }
        }
        .tv-photo-slot {
          animation: tv-photo-aura 5.2s ease-in-out infinite;
        }
        .tv-photo-slot.tv-photo-b { animation-delay: 2.6s; }

        /* Indicador de serviço — linha animada por baixo da DUPLA que serve */
        .tv-server-bar {
          position: absolute;
          height: 0.35vh;
          min-height: 3px;
          background: linear-gradient(
            90deg,
            transparent,
            #c4f600 20%,
            #c4f600 80%,
            transparent
          );
          border-radius: 999px;
          box-shadow: 0 0 16px #c4f600, 0 0 32px rgba(196, 246, 0, 0.55);
          animation: tv-server-bar 1.8s ease-in-out infinite;
        }
        @keyframes tv-server-bar {
          0%, 100% { opacity: 0.55; transform: scaleX(0.85); }
          50%      { opacity: 1;    transform: scaleX(1); }
        }

        /* Light sweep diagonal subtil sobre o BG */
        .tv-stage::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(
            110deg,
            transparent 35%,
            rgba(255, 255, 255, 0.06) 48%,
            rgba(66, 215, 255, 0.08) 50%,
            rgba(255, 255, 255, 0.06) 52%,
            transparent 65%
          );
          background-size: 250% 100%;
          background-position: -100% 0;
          animation: tv-sweep 14s linear infinite;
          mix-blend-mode: screen;
        }
        @keyframes tv-sweep {
          0%   { background-position: -100% 0; }
          100% { background-position: 250% 0;  }
        }

        /* === CELEBRAÇÃO DE FIM DE JOGO === */
        .tv-celebrate {
          position: absolute;
          inset: 0;
          z-index: 50;
          overflow: hidden;
          background: radial-gradient(
            ellipse at 50% 42%,
            rgba(14, 42, 74, 0.92) 0%,
            rgba(7, 26, 48, 0.95) 45%,
            rgba(3, 16, 31, 0.97) 100%
          );
          backdrop-filter: blur(2px);
          animation: tv-celebrate-fade 600ms ease-out forwards;
        }
        @keyframes tv-celebrate-fade {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        .tv-celebrate-burst {
          position: absolute;
          left: 50%;
          top: 48%;
          width: 80vw;
          height: 80vw;
          transform: translate(-50%, -50%) scale(0);
          background: radial-gradient(
            circle,
            rgba(66, 215, 255, 0.32) 0%,
            rgba(66, 215, 255, 0.10) 32%,
            transparent 66%
          );
          pointer-events: none;
          animation: tv-burst-in 900ms cubic-bezier(0.16, 1, 0.3, 1) forwards,
                     tv-burst-pulse 2.6s ease-in-out infinite 0.9s;
        }
        @keyframes tv-burst-in {
          0%   { transform: translate(-50%, -50%) scale(0);   opacity: 0; }
          60%  { opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1);   opacity: 0.9; }
        }
        @keyframes tv-burst-pulse {
          0%, 100% { opacity: 0.7; }
          50%      { opacity: 1; }
        }
        .tv-celebrate-panel {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          opacity: 0;
          animation: tv-panel-in 800ms cubic-bezier(0.16, 1, 0.3, 1) 250ms forwards;
        }
        @keyframes tv-panel-in {
          0%   { opacity: 0; transform: scale(0.88) translateY(2vh); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .tv-celebrate-label {
          display: flex;
          align-items: center;
          gap: 1vw;
          font-size: 2.2vw;
          font-weight: 900;
          font-style: italic;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: #42d7ff;
          text-shadow: 0 0 20px rgba(66, 215, 255, 0.7);
          animation: tv-label-pulse 2.4s ease-in-out infinite;
        }
        .tv-celebrate-trophy {
          font-size: 2.6vw;
          filter: drop-shadow(0 0 18px rgba(255, 210, 90, 0.85));
          animation: tv-trophy-bob 2.4s ease-in-out infinite;
        }
        @keyframes tv-trophy-bob {
          0%, 100% { transform: translateY(0)     rotate(-6deg); }
          50%      { transform: translateY(-0.6vh) rotate(6deg); }
        }
        @keyframes tv-label-pulse {
          0%, 100% { opacity: 0.8; }
          50%      { opacity: 1; }
        }
        .tv-celebrate-photo {
          height: 46vh;
          margin: 1.2vh 0 0.4vh;
          animation: tv-celebrate-photo-aura 3.4s ease-in-out infinite;
        }
        @keyframes tv-celebrate-photo-aura {
          0%, 100% {
            filter: drop-shadow(0 12px 28px rgba(0,0,0,0.6))
                    drop-shadow(0 0 30px rgba(66,215,255,0.25));
          }
          50% {
            filter: drop-shadow(0 12px 28px rgba(0,0,0,0.6))
                    drop-shadow(0 0 64px rgba(66,215,255,0.6));
          }
        }
        .tv-celebrate-photo img,
        .tv-celebrate-photo svg {
          height: 100%;
          width: auto;
          display: block;
          object-fit: contain;
        }
        .tv-celebrate-winner {
          font-size: 6.4vw;
          font-weight: 900;
          text-transform: uppercase;
          color: #fff;
          line-height: 1;
          animation: tv-celebrate-winner-glow 2.8s ease-in-out infinite;
        }
        @keyframes tv-celebrate-winner-glow {
          0%, 100% {
            text-shadow: 0 0 24px rgba(255,255,255,0.6), 0 0 56px rgba(66,215,255,0.55),
                         0 0 110px rgba(66,215,255,0.3), 0 6px 16px rgba(0,0,0,0.7);
          }
          50% {
            text-shadow: 0 0 38px rgba(255,255,255,0.85), 0 0 88px rgba(66,215,255,0.8),
                         0 0 170px rgba(66,215,255,0.45), 0 6px 16px rgba(0,0,0,0.7);
          }
        }
        .tv-celebrate-players {
          margin-top: 0.8vh;
          font-size: 2.6vw;
          font-weight: 900;
          text-transform: uppercase;
          color: #cdeaff;
          letter-spacing: 0.04em;
          text-shadow: 0 0 16px rgba(66,215,255,0.5), 0 3px 10px rgba(0,0,0,0.7);
        }
        .tv-celebrate-score {
          margin-top: 0.9vh;
          font-size: 1.5vw;
          font-weight: 900;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: #7fb8d8;
        }
        /* === ECRÃ DE ESPERA === */
        .tv-standby {
          position: absolute;
          inset: 0;
          z-index: 55;
          overflow: hidden;
          animation: tv-celebrate-fade 500ms ease-out forwards;
        }
        .tv-standby-bg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: fill;
          user-select: none;
        }
        .tv-standby-bg-fallback {
          background: radial-gradient(
            ellipse at 50% 40%,
            #0e2a4a 0%,
            #071a30 45%,
            #03101f 100%
          );
        }
        /* Respiração ambiente da imagem dedicada: zoom muito lento + brilho
           a pulsar. Subtil — a imagem mantém-se "viva" sem distorcer. */
        .tv-standby-breathe {
          object-fit: fill;
          animation: tv-standby-breathe 9s ease-in-out infinite;
          transform-origin: center center;
        }
        @keyframes tv-standby-breathe {
          0%, 100% {
            transform: scale(1);
            filter: brightness(1) saturate(1);
          }
          50% {
            transform: scale(1.025);
            filter: brightness(1.08) saturate(1.12);
          }
        }
        /* light sweep diagonal subtil, igual ao resto */
        .tv-standby::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(
            110deg,
            transparent 38%,
            rgba(255, 255, 255, 0.05) 49%,
            rgba(66, 215, 255, 0.08) 50%,
            rgba(255, 255, 255, 0.05) 51%,
            transparent 62%
          );
          background-size: 250% 100%;
          background-position: -100% 0;
          animation: tv-sweep 13s linear infinite;
          mix-blend-mode: screen;
        }
        .tv-standby-panel {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3vh;
          text-align: center;
          opacity: 0;
          animation: tv-panel-in 800ms cubic-bezier(0.16, 1, 0.3, 1) 200ms forwards;
        }
        .tv-standby-title {
          max-width: 72%;
          font-size: 7vw;
          font-weight: 900;
          line-height: 1.04;
          text-transform: uppercase;
          color: #fff;
          letter-spacing: 0.01em;
          animation: tv-standby-glow 3s ease-in-out infinite;
        }
        @keyframes tv-standby-glow {
          0%, 100% {
            text-shadow:
              0 0 26px rgba(255, 255, 255, 0.55),
              0 0 60px rgba(66, 215, 255, 0.45),
              0 6px 18px rgba(0, 0, 0, 0.7);
          }
          50% {
            text-shadow:
              0 0 40px rgba(255, 255, 255, 0.85),
              0 0 100px rgba(66, 215, 255, 0.75),
              0 6px 18px rgba(0, 0, 0, 0.7);
          }
        }
        .tv-standby-sub {
          display: flex;
          align-items: center;
          gap: 1.4vw;
          font-size: 1.9vw;
          font-weight: 800;
          font-style: italic;
          color: #42d7ff;
          letter-spacing: 0.08em;
          text-shadow: 0 0 18px rgba(66, 215, 255, 0.6);
          animation: tv-standby-pulse 2.6s ease-in-out infinite;
        }
        .tv-standby-line {
          display: inline-block;
          width: 0;
          height: 2px;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            transparent,
            #42d7ff 40%,
            #42d7ff 60%,
            transparent
          );
          box-shadow: 0 0 10px rgba(66, 215, 255, 0.7);
          animation: tv-standby-line-grow 900ms cubic-bezier(0.16, 1, 0.3, 1)
            500ms forwards;
        }
        @keyframes tv-standby-line-grow {
          to { width: 6vw; }
        }
        @keyframes tv-standby-pulse {
          0%, 100% { opacity: 0.7; }
          50%      { opacity: 1; }
        }
        .tv-celebrate-fx {
          position: absolute;
          inset: 0;
          z-index: 6;
          pointer-events: none;
          overflow: hidden;
        }
        .tv-flash {
          position: absolute;
          transform: translate(-50%, -50%) scale(0.25);
          border-radius: 50%;
          background: radial-gradient(circle,
            rgba(255, 255, 255, 0.95) 0%,
            rgba(220, 240, 255, 0.55) 22%,
            rgba(180, 225, 255, 0.18) 45%,
            transparent 70%);
          opacity: 0;
          animation: tv-flash-pop 220ms ease-out forwards;
          will-change: transform, opacity;
        }
        @keyframes tv-flash-pop {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.25); }
          18%  { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(1.15); }
        }
        .tv-flash-big {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at var(--bx) var(--by),
            rgba(255, 255, 255, 0.5) 0%,
            rgba(210, 235, 255, 0.18) 30%,
            transparent 60%);
          opacity: 0;
          animation: tv-flash-big-pop 320ms ease-out forwards;
        }
        @keyframes tv-flash-big-pop {
          0%   { opacity: 0; }
          20%  { opacity: 1; }
          100% { opacity: 0; }
        }

        /* Resposta em ecrã vertical / pequenas janelas */
        @media (max-aspect-ratio: 16 / 9) {
          .tv-score-a, .tv-score-b { font-size: 16vh !important; }
          .tv-jogo, .tv-vs, .tv-serve, .tv-dupla-a, .tv-dupla-b,
          .tv-footer, .tv-set-label { font-size: 2vh !important; }
          .tv-footer-item svg { width: 2.8vh; height: 2.8vh; }
          /* Separador continua linha fina — só a altura escala. */
          .tv-footer-sep { height: 3vh; }
          /* Nomes dos jogadores: tamanho é definido inline e adaptativo
             ao comprimento do nome (tvNameFontSize) — não sobrepor aqui
             com !important, senão nomes longos voltam a rebentar a caixa. */
          .tv-set-score { font-size: 5vh !important; }
        }
      `}</style>
      <div className="tv-body">
        <main className="tv-stage">
          {tournament.tv_background_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={tournament.tv_background_url}
              className="tv-background"
              alt=""
            />
          ) : null}

          {/* === FOTOS DAS DUPLAS ===
              Slot grande para TV 65". Encaixa nos "bolsos" superior-externos
              do BG. Se a dupla não tiver foto, mostra silhueta + letra. */}
          <div
            className="tv-photo-slot"
            style={{ left: "4%", top: "17%", width: "24%", height: "44%" }}
          >
            {match.team_a_photo_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={match.team_a_photo_url} alt="" />
            ) : (
              <TeamSilhouette side="A" />
            )}
          </div>
          <div
            className="tv-photo-slot tv-photo-b"
            style={{ right: "4%", top: "17%", width: "24%", height: "44%" }}
          >
            {match.team_b_photo_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={match.team_b_photo_url} alt="" />
            ) : (
              <TeamSilhouette side="B" />
            )}
          </div>

          {/* === TÍTULO CENTRAL: JOGO (live) ou PRÓXIMO JOGO (pré-jogo) === */}
          {preMatch ? (
            <div
              className="tv-text tv-prematch-title"
              style={{
                left: "50%",
                top: "33.5%",
                transform: "translateX(-50%)",
                fontSize: "2.6vw",
                color: "#42d7ff",
                fontStyle: "italic",
              }}
            >
              PRÓXIMO JOGO
            </div>
          ) : (
            <div
              className="tv-text tv-jogo"
              style={{
                left: "47%",
                top: "34.7%",
                width: "6%",
                fontSize: "1.7vw",
                color: "#42d7ff",
                fontStyle: "italic",
              }}
            >
              JOGO
            </div>
          )}

          {/* === SCORE A / "EM BREVE" / SCORE B === */}
          {preMatch ? (
            <div
              className="tv-text tv-prematch-soon"
              style={{
                left: "50%",
                top: "39%",
                transform: "translateX(-50%)",
                fontSize: "5.4vw",
              }}
            >
              EM BREVE
            </div>
          ) : (
            <>
              <div
                key={`a-${state.points_a}-${state.games_a}-${state.sets_a}`}
                className={[
                  "tv-text tv-score-a",
                  flashTeam === "A" ? "tv-score-flash" : "",
                ].join(" ")}
                style={{
                  left: "35%",
                  top: "37.2%",
                  transform: "translateX(-50%)",
                  fontSize: "9.1vw",
                  ...goldenStyle,
                }}
              >
                {state.points_a}
              </div>
              <div
                key={`b-${state.points_b}-${state.games_b}-${state.sets_b}`}
                className={[
                  "tv-text tv-score-b",
                  flashTeam === "B" ? "tv-score-flash" : "",
                ].join(" ")}
                style={{
                  left: "65%",
                  top: "37.2%",
                  transform: "translateX(-50%)",
                  fontSize: "9.1vw",
                  ...goldenStyle,
                }}
              >
                {state.points_b}
              </div>
            </>
          )}

          {/* === VS (sempre) === */}
          <div
            className="tv-text tv-vs"
            style={{
              left: "50%",
              top: "47%",
              transform: "translateX(-50%)",
              fontSize: "2.1vw",
              color: "#42d7ff",
            }}
          >
            VS
          </div>

          {/* === SERVIÇO / MOMENTO ===
              Tem que ficar DENTRO da pill desenhada no BG. */}
          <div
            className={[
              "tv-text tv-serve",
              serviceIsAnimated ? "tv-moment-pulse" : "",
            ].join(" ")}
            style={{
              left: "37%",
              top: "60.5%",
              width: "26%",
              fontSize: "1.45vw",
              color: "#3ed8ff",
              fontStyle: "italic",
            }}
          >
            {serviceText}
          </div>

          {/* === DUPLA A === */}
          <div
            className="tv-text tv-dupla-a"
            style={{
              left: "13.4%",
              top: "62.4%",
              width: "10.4%",
              fontSize: "1.8vw",
              fontStyle: "italic",
            }}
          >
            DUPLA A
          </div>

          {/* === DUPLA B === */}
          <div
            className="tv-text tv-dupla-b"
            style={{
              left: "77.7%",
              top: "62.4%",
              width: "10.4%",
              fontSize: "1.8vw",
              fontStyle: "italic",
            }}
          >
            DUPLA B
          </div>

          {/* === BARRA DE SERVIÇO (animada, debaixo da DUPLA que serve) === */}
          {!state.is_finished && !preMatch && (
            <div
              className="tv-server-bar"
              style={
                state.server === "A"
                  ? { left: "13.4%", top: "65.4%", width: "10.4%" }
                  : { left: "77.7%", top: "65.4%", width: "10.4%" }
              }
            />
          )}

          {/* === PLAYER A 1 === */}
          <div
            className="tv-text tv-player-a-1"
            style={{
              left: "4.5%",
              top: "69.2%",
              width: "25.5%",
              fontSize: tvNameFontSize(match.team_a_player1),
              textAlign: "left",
              paddingLeft: "1vw",
            }}
          >
            {match.team_a_player1}
          </div>
          {match.team_a_player2 && (
            <div
              className="tv-text tv-player-a-2"
              style={{
                left: "4.5%",
                top: "75.5%",
                width: "25.5%",
                fontSize: tvNameFontSize(match.team_a_player2),
                textAlign: "left",
                paddingLeft: "1vw",
              }}
            >
              {match.team_a_player2}
            </div>
          )}

          {/* === PLAYER B 1 === */}
          <div
            className="tv-text tv-player-b-1"
            style={{
              left: "70%",
              top: "69.2%",
              width: "25.5%",
              fontSize: tvNameFontSize(match.team_b_player1),
              textAlign: "right",
              paddingRight: "1vw",
            }}
          >
            {match.team_b_player1}
          </div>
          {match.team_b_player2 && (
            <div
              className="tv-text tv-player-b-2"
              style={{
                left: "70%",
                top: "75.5%",
                width: "25.5%",
                fontSize: tvNameFontSize(match.team_b_player2),
                textAlign: "right",
                paddingRight: "1vw",
              }}
            >
              {match.team_b_player2}
            </div>
          )}

          {/* === SETS (só em jogo, não em pré-jogo) === */}
          {!preMatch && (
            <>
              {[
                { left: "35.3%", label: "SET 1" },
                { left: "47.3%", label: "SET 2" },
                { left: "59.2%", label: "SET 3" },
              ].map((s, i) => (
                <div
                  key={`label-${i}`}
                  className="tv-text tv-set-label"
                  style={{
                    left: s.left,
                    top: "72.5%",
                    width: "6%",
                    fontSize: "1.25vw",
                    color: "#42d7ff",
                    fontStyle: "italic",
                  }}
                >
                  {s.label}
                </div>
              ))}
              {[
                { left: "34.9%", value: setStrings[0] },
                { left: "46.9%", value: setStrings[1] },
                { left: "58.8%", value: setStrings[2] },
              ].map((s, i) => (
                <div
                  key={`score-${i}`}
                  className="tv-text tv-set-score"
                  style={{
                    left: s.left,
                    top: "78.5%",
                    width: "6.8%",
                    fontSize: "2.5vw",
                  }}
                >
                  {s.value}
                </div>
              ))}
            </>
          )}

          {/* === FOOTER === */}
          <div
            className="tv-footer"
            style={{
              left: "10%",
              right: "10%",
              top: "90.5%",
              height: "5%",
              fontSize: "1.15vw",
            }}
          >
            <div className="tv-footer-item">
              <CourtIcon />
              <span>
                <span className="tv-label">CAMPO:</span> {match.court_name}
              </span>
            </div>
            <span className="tv-footer-sep" />
            <div className="tv-footer-item tv-footer-cat">
              <PeopleIcon />
              <span>
                <span className="tv-label">CATEGORIA:</span> {categoryLabel}
              </span>
            </div>
            <span className="tv-footer-sep" />
            <div className="tv-footer-item">
              <ClockIcon />
              <span>
                <span className="tv-label">TEMPO DE JOGO:</span> {elapsedStr}
              </span>
            </div>
          </div>

          {celebrateWinner && (
            <WinnerCelebration
              winner={celebrateWinner}
              photoUrl={
                celebrateWinner === "A"
                  ? match.team_a_photo_url
                  : match.team_b_photo_url
              }
              player1={
                celebrateWinner === "A"
                  ? match.team_a_player1
                  : match.team_b_player1
              }
              player2={
                celebrateWinner === "A"
                  ? match.team_a_player2
                  : match.team_b_player2
              }
              setsHistory={state.sets_history}
            />
          )}

          {standby &&
            (tournament.tv_standby_url ? (
              /* Imagem dedicada (já tem texto/branding) — só animação ambiente,
                 sem texto sobreposto. */
              <div className="tv-standby">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tournament.tv_standby_url}
                  className="tv-standby-bg tv-standby-breathe"
                  alt=""
                />
              </div>
            ) : (
              /* Sem imagem dedicada → ecrã genérico animado. */
              <div className="tv-standby">
                <div className="tv-standby-bg tv-standby-bg-fallback" />
                <div className="tv-standby-panel">
                  <div className="tv-standby-title">AGUARDE O PRÓXIMO JOGO</div>
                  <div className="tv-standby-sub">
                    <span className="tv-standby-line" />
                    Em instantes
                    <span className="tv-standby-line" />
                  </div>
                </div>
              </div>
            ))}

          {!online && (
            <div
              style={{
                position: "absolute",
                left: "1.2vw",
                bottom: "1.2vw",
                zIndex: 60,
                display: "flex",
                alignItems: "center",
                gap: "0.5vw",
                padding: "0.4vw 0.9vw",
                borderRadius: "999px",
                background: "rgba(120, 20, 20, 0.55)",
                color: "#ffd4d4",
                fontSize: "0.95vw",
                fontWeight: 900,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                backdropFilter: "blur(2px)",
              }}
            >
              <span
                style={{
                  width: "0.6vw",
                  height: "0.6vw",
                  borderRadius: "50%",
                  background: "#ff5d5d",
                  boxShadow: "0 0 8px #ff5d5d",
                }}
              />
              Sem ligação — a reconectar
            </div>
          )}
        </main>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Celebração de fim de jogo (flashes de imprensa)
// ---------------------------------------------------------------------------
function WinnerCelebration({
  winner,
  photoUrl,
  player1,
  player2,
  setsHistory,
}: {
  winner: "A" | "B";
  photoUrl: string | null;
  player1: string;
  player2: string | null;
  setsHistory: { a: number; b: number }[];
}) {
  // Camada de flashes manipulada imperativamente (DOM) para não disparar
  // dezenas de re-renders/seg no React. Espelha o mockup aprovado.
  const fxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = fxRef.current;
    if (!layer) return;
    let mounted = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const rate = 200; // ms — ritmo aprovado

    function edgePos(): { x: number; y: number } {
      const e = Math.random();
      if (e < 0.42) return { x: Math.random() * 100, y: Math.random() * 28 };
      if (e < 0.71)
        return {
          x: Math.random() < 0.5 ? Math.random() * 22 : 78 + Math.random() * 22,
          y: Math.random() * 100,
        };
      if (e < 0.9) return { x: Math.random() * 100, y: 74 + Math.random() * 26 };
      return {
        x: Math.random() * 100,
        y: Math.random() < 0.5 ? 18 + Math.random() * 18 : 64 + Math.random() * 18,
      };
    }

    function spawn() {
      if (!mounted) return;
      const burst =
        1 + (Math.random() < 0.35 ? ((Math.random() * 2) | 0) + 1 : 0);
      for (let k = 0; k < burst; k++) {
        const t = setTimeout(() => {
          if (!mounted || !fxRef.current) return;
          const { x, y } = edgePos();
          const size = 5 + Math.random() * 10;
          const f = document.createElement("div");
          f.className = "tv-flash";
          f.style.left = x + "vw";
          f.style.top = y + "vh";
          f.style.width = size + "vw";
          f.style.height = size + "vw";
          f.style.animationDuration = 170 + Math.random() * 140 + "ms";
          fxRef.current.appendChild(f);
          const rm = setTimeout(() => f.remove(), 380);
          timers.push(rm);
        }, k * 70);
        timers.push(t);
      }

      if (Math.random() < 0.07 && fxRef.current) {
        const { x, y } = edgePos();
        const bf = document.createElement("div");
        bf.className = "tv-flash-big";
        bf.style.setProperty("--bx", x + "%");
        bf.style.setProperty("--by", y + "%");
        fxRef.current.appendChild(bf);
        const rm = setTimeout(() => bf.remove(), 360);
        timers.push(rm);
      }

      timers.push(setTimeout(spawn, rate * (0.55 + Math.random())));
    }

    spawn();
    for (let i = 0; i < 10; i++) {
      timers.push(setTimeout(spawn, 250 + i * 120));
    }

    return () => {
      mounted = false;
      timers.forEach(clearTimeout);
      if (layer) layer.innerHTML = "";
    };
  }, []);

  const players = [player1, player2].filter(Boolean).join("  ·  ");
  const score = setsHistory.map((s) => `${s.a}-${s.b}`).join("  ·  ");

  return (
    <div className="tv-celebrate">
      <div className="tv-celebrate-burst" />
      <div className="tv-celebrate-fx" ref={fxRef} />
      <div className="tv-celebrate-panel">
        <div className="tv-celebrate-label">
          <span className="tv-celebrate-trophy">🏆</span>
          <span>VENCEDOR</span>
        </div>
        <div className="tv-celebrate-photo">
          {photoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={photoUrl} alt="" />
          ) : (
            <TeamSilhouette side={winner} />
          )}
        </div>
        <div className="tv-celebrate-winner">DUPLA {winner}</div>
        {players && <div className="tv-celebrate-players">{players}</div>}
        {score && <div className="tv-celebrate-score">{score}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Critical moment detection
// ---------------------------------------------------------------------------
type Moment = { label: string; team: "A" | "B" | "both" };

function useCriticalMoment(state: TVState, config: MatchConfig): Moment | null {
  if (state.is_finished) return null;
  const engineState: EngineMatchState = {
    pointsA: state.points_a,
    pointsB: state.points_b,
    gamesA: state.games_a,
    gamesB: state.games_b,
    setsA: state.sets_a,
    setsB: state.sets_b,
    setsHistory: state.sets_history,
    server: state.server,
    inTiebreak: state.in_tiebreak,
    inSuperTiebreak: state.in_super_tiebreak,
    isFinished: state.is_finished,
    winner: state.winner,
  };
  const afterA = applyEvent(engineState, { type: "point", team: "A" }, config);
  const afterB = applyEvent(engineState, { type: "point", team: "B" }, config);
  const setsBefore = engineState.setsA + engineState.setsB;
  const matchPointA = afterA.isFinished && afterA.winner === "A";
  const matchPointB = afterB.isFinished && afterB.winner === "B";
  if (matchPointA && matchPointB) return { label: "MATCH POINT", team: "both" };
  if (matchPointA) return { label: "MATCH POINT", team: "A" };
  if (matchPointB) return { label: "MATCH POINT", team: "B" };
  const setPointA = afterA.setsA + afterA.setsB > setsBefore;
  const setPointB = afterB.setsA + afterB.setsB > setsBefore;
  if (setPointA && setPointB) return { label: "SET POINT", team: "both" };
  if (setPointA) return { label: "SET POINT", team: "A" };
  if (setPointB) return { label: "SET POINT", team: "B" };
  if (
    config.goldenPoint &&
    !engineState.inTiebreak &&
    !engineState.inSuperTiebreak &&
    engineState.pointsA === "40" &&
    engineState.pointsB === "40"
  ) {
    return { label: "GOLDEN POINT", team: "both" };
  }
  if (engineState.inSuperTiebreak) return { label: "SUPER TIEBREAK", team: "both" };
  if (engineState.inTiebreak) return { label: "TIEBREAK", team: "both" };
  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function useElapsedSeconds(
  startedAt: string | null,
  finishedAt: string | null,
  fallback: number | null = null,
): number | null {
  // `fallback` vem calculado do servidor — usado enquanto o JS do cliente
  // ainda não ticou (ou se nunca ticar). Sem isto, o relógio ficava preso
  // em "—" se o useEffect não arrancasse no ambiente da TV.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!startedAt) return;
    if (finishedAt) {
      setNow(new Date(finishedAt).getTime());
      return;
    }
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt, finishedAt]);
  if (!startedAt) return null;
  if (now === null) return fallback;
  const end = finishedAt ? new Date(finishedAt).getTime() : now;
  return Math.max(0, Math.floor((end - new Date(startedAt).getTime()) / 1000));
}

function formatElapsed(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

/**
 * Tamanho de fonte adaptativo para os nomes dos jogadores na TV.
 * A caixa da dupla tem ~25% de largura. Nomes longos (ex.: "NICOLAU
 * MONTEIRO") rebentavam a caixa a um tamanho fixo — esta função encolhe
 * proporcionalmente quando o nome passa de ~12 caracteres, mantendo-o
 * sempre dentro da caixa.
 */
function tvNameFontSize(name: string): string {
  const len = Math.max(1, (name ?? "").trim().length);
  const FITS = 12; // nº de caracteres que cabem ao tamanho base
  const BASE = 2.35; // vw
  if (len <= FITS) return `${BASE}vw`;
  const vw = Math.max(1.45, (BASE * FITS) / len);
  return `${vw.toFixed(2)}vw`;
}

// ---------------------------------------------------------------------------
// Footer icons
// ---------------------------------------------------------------------------
function CourtIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="2.5"
        y="6"
        width="19"
        height="12"
        rx="0.8"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <line x1="12" y1="6" x2="12" y2="18" stroke="currentColor" strokeWidth="1.6" />
      <line x1="2.5" y1="12" x2="8" y2="12" stroke="currentColor" strokeWidth="1.6" />
      <line x1="16" y1="12" x2="21.5" y2="12" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3 19.5c0-3 2.7-5.2 6-5.2s6 2.2 6 5.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M15 18.5c0.3-2 2-3.4 3.6-3.4 1.7 0 3.4 1.4 3.4 3.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 6.5V12l3.5 2.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Silhueta de fallback para quando a dupla não tem foto carregada
// ---------------------------------------------------------------------------
function TeamSilhouette({ side }: { side: "A" | "B" }) {
  // Duas silhuetas sobrepostas (jogador 1 + jogador 2) + letra grande da dupla.
  return (
    <div className="tv-photo-placeholder">
      <svg viewBox="0 0 200 240" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
        <defs>
          <linearGradient id={`silh-${side}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(66, 215, 255, 0.55)" />
            <stop offset="100%" stopColor="rgba(66, 215, 255, 0.1)" />
          </linearGradient>
        </defs>

        {/* Jogador 2 (atrás, ligeiramente deslocado) */}
        <g opacity="0.6">
          <circle cx="125" cy="78" r="22" fill={`url(#silh-${side})`} />
          <path
            d="M 80 240 Q 80 165 105 150 Q 120 142 125 142 Q 130 142 145 150 Q 170 165 170 240 Z"
            fill={`url(#silh-${side})`}
          />
        </g>

        {/* Jogador 1 (à frente) */}
        <g>
          <circle cx="75" cy="72" r="26" fill={`url(#silh-${side})`} />
          <path
            d="M 25 240 Q 25 158 55 142 Q 70 134 75 134 Q 80 134 95 142 Q 125 158 125 240 Z"
            fill={`url(#silh-${side})`}
          />
        </g>

        {/* Letra da dupla, grande e brilhante */}
        <text
          x="100"
          y="225"
          textAnchor="middle"
          fontSize="58"
          fontWeight="900"
          fill="rgba(255, 255, 255, 0.92)"
          style={{
            paintOrder: "stroke",
            stroke: "rgba(66, 215, 255, 0.85)",
            strokeWidth: 3,
          }}
        >
          {side}
        </text>
      </svg>
    </div>
  );
}
