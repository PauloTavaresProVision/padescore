"use client";

import { useTransition } from "react";
import { TrashIcon } from "@/components/icons";

export function DeleteTournamentButton({
  action,
  tournamentName,
}: {
  action: () => Promise<void>;
  tournamentName: string;
}) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const confirmed = confirm(
          `Apagar o torneio "${tournamentName}"? Todos os jogos, pontos e história serão apagados. Esta acção não se desfaz.`,
        );
        if (confirmed) start(() => action());
      }}
      className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-2 text-sm font-semibold text-red-300 transition hover:border-red-500/50 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <TrashIcon className="h-4 w-4" />
      {pending ? "A apagar..." : "Apagar torneio"}
    </button>
  );
}
