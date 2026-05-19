"use client";

import { useTransition } from "react";
import {
  adminAddPoint,
  adminUndo,
  adminResetMatch,
  adminRegenerateToken,
  adminDeleteMatch,
} from "./actions";
import { KeyIcon, RotateIcon, TrashIcon, UndoIcon } from "@/components/icons";

export function AdminControls({
  tournamentId,
  matchId,
  teamAName,
  teamBName,
  isFinished,
}: {
  tournamentId: string;
  matchId: string;
  teamAName: string;
  teamBName: string;
  isFinished: boolean;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      {/* Pontuação rápida */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <BigPointButton
          disabled={pending || isFinished}
          onClick={() => start(() => adminAddPoint(tournamentId, matchId, "A"))}
          team="A"
          name={teamAName}
        />
        <BigPointButton
          disabled={pending || isFinished}
          onClick={() => start(() => adminAddPoint(tournamentId, matchId, "B"))}
          team="B"
          name={teamBName}
        />
      </div>

      <p className="text-xs text-slate-500">
        Correcções avançadas (desfazer game/set, trocar serviço) estão no marcador
        do operador no telemóvel.
      </p>

      {/* Acções */}
      <div className="flex flex-wrap items-center gap-2">
        <SecondaryButton
          disabled={pending}
          onClick={() => start(() => adminUndo(tournamentId, matchId))}
          variant="warn"
        >
          <UndoIcon className="h-4 w-4" />
          Desfazer ponto
        </SecondaryButton>

        <SecondaryButton
          disabled={pending}
          onClick={() => {
            if (confirm("Reset total do jogo? Apaga todos os pontos registados.")) {
              start(() => adminResetMatch(tournamentId, matchId));
            }
          }}
        >
          <RotateIcon className="h-4 w-4" />
          Reset
        </SecondaryButton>

        <SecondaryButton
          disabled={pending}
          onClick={() => {
            if (confirm("Gerar novo link do operador? O link actual deixa de funcionar.")) {
              start(() => adminRegenerateToken(tournamentId, matchId));
            }
          }}
        >
          <KeyIcon className="h-4 w-4" />
          Regenerar token
        </SecondaryButton>

        <div className="ml-auto" />

        <SecondaryButton
          disabled={pending}
          onClick={() => {
            if (confirm("Apagar este jogo definitivamente? Não se desfaz.")) {
              start(() => adminDeleteMatch(tournamentId, matchId));
            }
          }}
          variant="danger"
        >
          <TrashIcon className="h-4 w-4" />
          Apagar
        </SecondaryButton>
      </div>
    </div>
  );
}

function BigPointButton({
  team,
  name,
  disabled,
  onClick,
}: {
  team: "A" | "B";
  name: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "group relative overflow-hidden rounded-2xl border p-5 text-left transition",
        "disabled:cursor-not-allowed disabled:opacity-50",
        team === "A"
          ? "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40 hover:bg-emerald-500/10"
          : "border-cyan-500/20 bg-cyan-500/5 hover:border-cyan-500/40 hover:bg-cyan-500/10",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <span
          className={[
            "text-[11px] font-semibold uppercase tracking-widest",
            team === "A" ? "text-emerald-300/70" : "text-cyan-300/70",
          ].join(" ")}
        >
          Equipa {team}
        </span>
        <span
          className={[
            "text-2xl font-bold transition group-hover:scale-110",
            team === "A" ? "text-emerald-400" : "text-cyan-400",
          ].join(" ")}
        >
          +1
        </span>
      </div>
      <div className="mt-2 truncate text-base font-semibold text-white">{name}</div>
      <div className="mt-1 text-xs text-slate-400">Clica para adicionar ponto</div>
    </button>
  );
}

function SecondaryButton({
  children,
  disabled,
  onClick,
  variant = "default",
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  variant?: "default" | "warn" | "danger";
}) {
  const styles = {
    default: "border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-600 hover:bg-slate-800",
    warn: "border-amber-500/30 bg-amber-500/5 text-amber-300 hover:border-amber-500/50 hover:bg-amber-500/10",
    danger: "border-red-500/30 bg-red-500/5 text-red-300 hover:border-red-500/50 hover:bg-red-500/10",
  }[variant];

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        styles,
      ].join(" ")}
    >
      {children}
    </button>
  );
}
