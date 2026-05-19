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
          ? "border-emerald-200 bg-emerald-50 hover:border-emerald-300 hover:bg-emerald-100"
          : "border-cyan-200 bg-cyan-50 hover:border-cyan-300 hover:bg-cyan-100",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <span
          className={[
            "text-[11px] font-semibold uppercase tracking-widest",
            team === "A" ? "text-emerald-600" : "text-cyan-600",
          ].join(" ")}
        >
          Equipa {team}
        </span>
        <span
          className={[
            "text-2xl font-extrabold transition group-hover:scale-110",
            team === "A" ? "text-emerald-600" : "text-cyan-600",
          ].join(" ")}
        >
          +1
        </span>
      </div>
      <div className="mt-2 truncate text-base font-bold text-slate-900">{name}</div>
      <div className="mt-1 text-xs text-slate-500">Clica para adicionar ponto</div>
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
    default: "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50",
    warn: "border-amber-300 bg-amber-50 text-amber-700 hover:border-amber-400 hover:bg-amber-100",
    danger: "border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100",
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
