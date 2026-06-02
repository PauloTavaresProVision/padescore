"use client";

import { useState, useTransition } from "react";
import {
  createCourt,
  renameCourt,
  deleteCourt,
  reorderCourts,
} from "@/app/admin/tournaments/[id]/courts/actions";

export interface CourtRow {
  id: string;
  name: string;
  sort_order: number;
  /** Número de jogos associados — para mostrar e bloquear delete se >0. */
  matchCount: number;
}

export function CourtsManager({
  tournamentId,
  initialCourts,
}: {
  tournamentId: string;
  initialCourts: CourtRow[];
}) {
  const [courts, setCourts] = useState(initialCourts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function bindCreate(formData: FormData) {
    startTransition(async () => {
      await createCourt(tournamentId, formData);
    });
  }
  function bindRename(courtId: string) {
    return (formData: FormData) => {
      startTransition(async () => {
        await renameCourt(tournamentId, courtId, formData);
        setEditingId(null);
      });
    };
  }
  function handleDelete(c: CourtRow) {
    if (c.matchCount > 0) {
      alert(
        `Não dá para apagar "${c.name}" — tem ${c.matchCount} jogo(s) associado(s). Move-os para outro campo primeiro.`,
      );
      return;
    }
    if (!confirm(`Apagar campo "${c.name}"?`)) return;
    startTransition(async () => {
      await deleteCourt(tournamentId, c.id);
    });
  }

  function move(courtId: string, dir: -1 | 1) {
    const idx = courts.findIndex((c) => c.id === courtId);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= courts.length) return;
    const next = [...courts];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    setCourts(next); // optimistic
    startTransition(async () => {
      await reorderCourts(
        tournamentId,
        next.map((c) => c.id),
      );
    });
  }

  return (
    <div>
      {courts.length === 0 ? (
        <p className="mb-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Sem campos ainda. Adiciona o primeiro abaixo — é necessário para criar jogos.
        </p>
      ) : (
        <ul className="mb-3 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {courts.map((c, i) => (
            <li
              key={c.id}
              className="flex items-center gap-2 px-3 py-2.5 text-sm"
            >
              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  onClick={() => move(c.id, -1)}
                  disabled={i === 0 || pending}
                  className="h-3.5 w-5 leading-none text-slate-300 transition hover:text-slate-700 disabled:opacity-30"
                  aria-label="Subir"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => move(c.id, 1)}
                  disabled={i === courts.length - 1 || pending}
                  className="h-3.5 w-5 leading-none text-slate-300 transition hover:text-slate-700 disabled:opacity-30"
                  aria-label="Descer"
                >
                  ▼
                </button>
              </div>

              {editingId === c.id ? (
                <form action={bindRename(c.id)} className="flex flex-1 items-center gap-2">
                  <input
                    name="name"
                    defaultValue={c.name}
                    autoFocus
                    required
                    maxLength={60}
                    className="flex-1 rounded border border-emerald-400 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-600"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    disabled={pending}
                    className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    ✕
                  </button>
                </form>
              ) : (
                <>
                  <span className="flex-1 font-medium text-slate-900">
                    {c.name}
                  </span>
                  <span className="text-xs text-slate-500">
                    {c.matchCount === 0
                      ? "sem jogos"
                      : c.matchCount === 1
                        ? "1 jogo"
                        : `${c.matchCount} jogos`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingId(c.id)}
                    className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    Renomear
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(c)}
                    disabled={c.matchCount > 0}
                    className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-600 transition hover:border-red-300 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    title={c.matchCount > 0 ? "Move/apaga os jogos primeiro" : ""}
                  >
                    Apagar
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <form action={bindCreate} className="flex items-center gap-2">
        <input
          name="name"
          placeholder='Adicionar campo (ex.: "Campo 1")'
          required
          maxLength={60}
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-emerald-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
        >
          + Adicionar
        </button>
      </form>
    </div>
  );
}
