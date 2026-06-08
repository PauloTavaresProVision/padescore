"use client";

import { useState } from "react";

interface GameSnapshot {
  teamA: string;
  teamB: string;
  scheduledAt: string;
  field: string | null;
}

interface Props {
  token: string;
  playerName: string;
  playerRole: "partner" | "opponent";
  status: "pending" | "accepted" | "rejected";
  decidedAt: string | null;
  requestStatus: string;
  requesterName: string;
  reason: string;
  preferredSlot: string | null;
  gameSnapshot: GameSnapshot;
}

export function ConfirmClient(props: Props) {
  const [currentStatus, setCurrentStatus] = useState(props.status);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "accepted" | "rejected") {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/reschedule-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: props.token, decision }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Erro ${res.status}`);
        return;
      }
      setCurrentStatus(decision);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro de rede");
    } finally {
      setSubmitting(false);
    }
  }

  const roleLabel = props.playerRole === "partner" ? "tua parceira" : "adversário";

  return (
    <div className="space-y-4">
      {/* Identidade */}
      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Olá
        </div>
        <div className="mt-0.5 text-xl font-extrabold text-slate-900">
          {props.playerName}
        </div>
        <div className="mt-1 text-xs text-slate-600">
          És {roleLabel} do <b>{props.requesterName}</b> neste jogo.
        </div>
      </div>

      {/* Jogo */}
      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Jogo
        </div>
        <div className="mt-1 text-base font-bold text-slate-900">
          {props.gameSnapshot.teamA}{" "}
          <span className="text-emerald-600">VS</span>{" "}
          {props.gameSnapshot.teamB}
        </div>
        <div className="mt-2 text-sm text-slate-600">
          📅 {formatDayLong(props.gameSnapshot.scheduledAt.slice(0, 10))} às{" "}
          {formatTime(props.gameSnapshot.scheduledAt)}
          {props.gameSnapshot.field && (
            <> · 🏟 {props.gameSnapshot.field}</>
          )}
        </div>
      </div>

      {/* Pedido */}
      <div className="rounded-xl bg-amber-50 p-4 shadow-sm ring-1 ring-amber-200">
        <div className="text-xs font-semibold uppercase tracking-wider text-amber-700">
          {props.requesterName} pediu alteração
        </div>
        <div className="mt-2 text-sm text-slate-800">
          <b>Motivo:</b> {props.reason}
        </div>
        {props.preferredSlot && (
          <div className="mt-2 text-sm text-slate-800">
            <b>Disponibilidade alternativa:</b> {props.preferredSlot}
          </div>
        )}
      </div>

      {/* Acção */}
      {currentStatus === "pending" ? (
        <>
          <div className="rounded-xl bg-slate-50 p-3 text-center text-xs text-slate-600">
            <b>Concordas com este pedido?</b>
            <p className="mt-1">
              O clube vai decidir depois se consegue encaixar um novo horário.
              Esta resposta ajuda-os a perceber se podem avançar.
            </p>
          </div>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              onClick={() => decide("rejected")}
              disabled={submitting}
              className="rounded-xl border-2 border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-700 transition hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
            >
              ✗ Não concordo
            </button>
            <button
              onClick={() => decide("accepted")}
              disabled={submitting}
              className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-50"
            >
              ✓ Concordo
            </button>
          </div>
        </>
      ) : currentStatus === "accepted" ? (
        <div className="rounded-xl bg-emerald-50 p-5 text-center ring-1 ring-emerald-200">
          <div className="text-4xl">✅</div>
          <div className="mt-2 text-base font-bold text-emerald-900">
            Concordaste!
          </div>
          <p className="mt-1 text-xs text-emerald-700">
            O clube vai avaliar e responder. Obrigado.
          </p>
        </div>
      ) : (
        <div className="rounded-xl bg-red-50 p-5 text-center ring-1 ring-red-200">
          <div className="text-4xl">✗</div>
          <div className="mt-2 text-base font-bold text-red-900">
            Não concordaste
          </div>
          <p className="mt-1 text-xs text-red-700">
            O clube foi informado. Se for engano, contacta o clube directamente.
          </p>
        </div>
      )}

      <p className="text-center text-[11px] text-slate-400">
        {props.playerRole === "partner"
          ? "Como parceira, a tua concordância é importante para o pedido seguir."
          : "Basta um dos adversários concordar para o pedido seguir. O clube decide depois."}
      </p>
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDayLong(day: string): string {
  const d = new Date(`${day}T12:00:00`);
  const weekday = d.toLocaleDateString("pt-PT", { weekday: "long" });
  const dd = d.toLocaleDateString("pt-PT", { day: "2-digit", month: "long" });
  return `${weekday[0].toUpperCase()}${weekday.slice(1)}, ${dd}`;
}
