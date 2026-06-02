"use client";

import { useState } from "react";
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
  // Ordem optimista para o reorder (UI muda já, server actualiza em background).
  const [courts, setCourts] = useState(initialCourts);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Resync se a lista do servidor mudar (ex.: depois de criar/apagar).
  // Comparamos por (id, sort_order) — se algo mudou, replicamos.
  const initialKey = initialCourts
    .map((c) => `${c.id}:${c.sort_order}`)
    .join("|");
  const currentKey = courts.map((c) => `${c.id}:${c.sort_order}`).join("|");
  if (initialKey !== currentKey && initialCourts.length !== courts.length) {
    setCourts(initialCourts);
  }

  // Action wrappers — passam o tournamentId/courtId fixos.
  // IMPORTANTE: retornam a promise directamente, sem startTransition.
  // O <form action> do React 19 sabe esperar pelo server action sozinho.
  async function handleCreate(formData: FormData) {
    await createCourt(tournamentId, formData);
  }
  function handleRename(courtId: string) {
    return async (formData: FormData) => {
      await renameCourt(tournamentId, courtId, formData);
      setEditingId(null);
    };
  }
  async function handleDelete(c: CourtRow) {
    if (c.matchCount > 0) {
      alert(
        `Não dá para apagar "${c.name}" — tem ${c.matchCount} jogo(s) associado(s). Move-os para outro campo primeiro.`,
      );
      return;
    }
    if (!confirm(`Apagar campo "${c.name}"?`)) return;
    await deleteCourt(tournamentId, c.id);
  }
  async function move(courtId: string, dir: -1 | 1) {
    const idx = courts.findIndex((c) => c.id === courtId);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= courts.length) return;
    const next = [...courts];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    setCourts(next); // optimistic
    await reorderCourts(
      tournamentId,
      next.map((c) => c.id),
    );
  }

  return (
    <div>
      {courts.length === 0 ? (
        <div className="mb-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <p className="text-sm text-slate-600">
            Ainda não tens campos definidos.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Adiciona o 1º abaixo — é necessário para criar jogos.
          </p>
        </div>
      ) : (
        <div className="mb-4 overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="w-16 px-3 py-2 text-left font-semibold">
                  Ordem
                </th>
                <th className="px-3 py-2 text-left font-semibold">Nome</th>
                <th className="w-24 px-3 py-2 text-left font-semibold">
                  Jogos
                </th>
                <th className="w-44 px-3 py-2 text-right font-semibold">
                  Acções
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {courts.map((c, i) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => move(c.id, -1)}
                        disabled={i === 0}
                        className="grid h-6 w-6 place-items-center rounded text-slate-400 transition hover:bg-slate-200 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent"
                        aria-label="Subir"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => move(c.id, 1)}
                        disabled={i === courts.length - 1}
                        className="grid h-6 w-6 place-items-center rounded text-slate-400 transition hover:bg-slate-200 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent"
                        aria-label="Descer"
                      >
                        ▼
                      </button>
                    </div>
                  </td>

                  <td className="px-3 py-2">
                    {editingId === c.id ? (
                      <form
                        action={handleRename(c.id)}
                        className="flex items-center gap-2"
                      >
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
                          className="rounded bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-600"
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Cancelar
                        </button>
                      </form>
                    ) : (
                      <span className="font-semibold text-slate-900">
                        {c.name}
                      </span>
                    )}
                  </td>

                  <td className="px-3 py-2 text-slate-600">
                    {c.matchCount === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : c.matchCount === 1 ? (
                      "1 jogo"
                    ) : (
                      `${c.matchCount} jogos`
                    )}
                  </td>

                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-2">
                      {editingId !== c.id && (
                        <>
                          <button
                            type="button"
                            onClick={() => setEditingId(c.id)}
                            className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                          >
                            Renomear
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(c)}
                            disabled={c.matchCount > 0}
                            className="rounded border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                            title={
                              c.matchCount > 0
                                ? "Move/apaga os jogos primeiro"
                                : ""
                            }
                          >
                            Apagar
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Adicionar novo */}
      <form action={handleCreate} className="flex items-center gap-2">
        <input
          name="name"
          placeholder='Adicionar campo (ex.: "Campo 1")'
          required
          maxLength={60}
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
        />
        <button
          type="submit"
          className="rounded-lg bg-emerald-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
        >
          + Adicionar
        </button>
      </form>
    </div>
  );
}
