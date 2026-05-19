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
      className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <TrashIcon className="h-4 w-4" />
      {pending ? "A apagar..." : "Apagar torneio"}
    </button>
  );
}
