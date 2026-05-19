"use client";

import { useMemo, useState } from "react";
import { LinkButton } from "@/components/ui/Button";
import { PlusIcon, UsersIcon } from "@/components/icons";
import { PlayerRow } from "./PlayerRow";

interface Player {
  id: string;
  name: string;
  short_name: string | null;
  photo_url: string | null;
  mirror: boolean;
}

export function PlayerList({ players }: { players: Player[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.short_name?.toLowerCase().includes(q) ?? false),
    );
  }, [players, query]);

  if (players.length === 0) {
    return <EmptyState />;
  }

  return (
    <>
      {/* Search */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-sm">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            🔍
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Procurar jogador..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpar"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>
        <span className="text-xs font-medium text-slate-500">
          {filtered.length} de {players.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          Nenhum jogador para &ldquo;{query}&rdquo;.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <PlayerRow key={p.id} player={p} />
          ))}
        </ul>
      )}
    </>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl bg-white p-16 text-center ring-1 ring-slate-200/80 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
        <UsersIcon className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-slate-900">Sem jogadores</h2>
      <p className="mt-1 text-sm text-slate-500">
        Adiciona o primeiro jogador para começar a montar duplas nos jogos.
      </p>
      <div className="mt-6">
        <LinkButton href="/admin/players/new">
          <PlusIcon className="h-4 w-4" />
          Adicionar primeiro jogador
        </LinkButton>
      </div>
    </div>
  );
}
