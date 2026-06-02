"use client";

import { useState } from "react";
import {
  createTotem,
  regenerateToken,
  renameTotem,
  deleteTotem,
} from "./actions";

export interface TotemInfo {
  id: string;
  name: string;
  apiToken: string;
  apiUrl: string;
  lastSeenAt: string | null;
}
export interface CourtTotemRow {
  court: { id: string; name: string };
  totem: TotemInfo | null;
}

export function TotensTable({
  tournamentId,
  rows,
}: {
  tournamentId: string;
  rows: CourtTotemRow[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleCreate(courtId: string) {
    await createTotem(tournamentId, courtId);
  }
  function handleRename(totemId: string) {
    return async (formData: FormData) => {
      await renameTotem(tournamentId, totemId, formData);
      setEditingId(null);
    };
  }
  async function handleRegenerate(totem: TotemInfo) {
    if (
      !confirm(
        `Gerar NOVO token para "${totem.name}"?\n\nO token actual vai parar de funcionar — a app Windows do totem terá de ser actualizada com o novo URL.`,
      )
    )
      return;
    await regenerateToken(tournamentId, totem.id);
  }
  async function handleDelete(totem: TotemInfo) {
    if (
      !confirm(`Apagar o totem "${totem.name}"?\n\nA app Windows deste totem deixa de funcionar.`)
    )
      return;
    await deleteTotem(tournamentId, totem.id);
  }

  async function copy(text: string, id: string) {
    try {
      // Modern API + fallback (mesmo que no CopyButton)
      if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      alert("Não consegui copiar — selecciona e copia manualmente.");
    }
  }

  function lastSeenLabel(iso: string | null): string {
    if (!iso) return "Nunca";
    const diff = Date.now() - new Date(iso).getTime();
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return "agora mesmo";
    if (sec < 3600) return `há ${Math.floor(sec / 60)} min`;
    if (sec < 86400) return `há ${Math.floor(sec / 3600)} h`;
    return `há ${Math.floor(sec / 86400)} d`;
  }
  function lastSeenColor(iso: string | null): string {
    if (!iso) return "text-slate-400";
    const sec = (Date.now() - new Date(iso).getTime()) / 1000;
    if (sec < 120) return "text-emerald-600";
    if (sec < 600) return "text-amber-600";
    return "text-red-600";
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">Campo</th>
            <th className="px-3 py-2 text-left font-semibold">Totem</th>
            <th className="px-3 py-2 text-left font-semibold">URL da API</th>
            <th className="w-24 px-3 py-2 text-left font-semibold">
              Último contacto
            </th>
            <th className="w-44 px-3 py-2 text-right font-semibold">Acções</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((r) => (
            <tr key={r.court.id} className="hover:bg-slate-50">
              {/* Campo */}
              <td className="px-3 py-3 align-top font-semibold text-slate-900">
                {r.court.name}
              </td>

              {/* Totem */}
              <td className="px-3 py-3 align-top">
                {!r.totem ? (
                  <span className="text-xs text-slate-400 italic">— sem totem</span>
                ) : editingId === r.totem.id ? (
                  <form
                    action={handleRename(r.totem.id)}
                    className="flex items-center gap-2"
                  >
                    <input
                      name="name"
                      defaultValue={r.totem.name}
                      autoFocus
                      required
                      maxLength={60}
                      className="rounded border border-emerald-400 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <button
                      type="submit"
                      className="rounded bg-emerald-500 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-600"
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      ✕
                    </button>
                  </form>
                ) : (
                  <span className="text-slate-700">{r.totem.name}</span>
                )}
              </td>

              {/* URL da API */}
              <td className="px-3 py-3 align-top">
                {r.totem ? (
                  <div className="flex items-center gap-2">
                    <code className="block max-w-[28ch] truncate rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700">
                      {r.totem.apiUrl}
                    </code>
                    <button
                      type="button"
                      onClick={() => copy(r.totem!.apiUrl, r.totem!.id)}
                      className={`rounded border px-2 py-1 text-xs font-medium transition ${
                        copiedId === r.totem.id
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                      }`}
                    >
                      {copiedId === r.totem.id ? "✓ Copiado" : "Copiar"}
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </td>

              {/* Último contacto */}
              <td className="px-3 py-3 align-top">
                {r.totem ? (
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${
                        r.totem.lastSeenAt &&
                        Date.now() - new Date(r.totem.lastSeenAt).getTime() <
                          120000
                          ? "bg-emerald-500"
                          : "bg-slate-300"
                      }`}
                    />
                    <span className={`text-xs ${lastSeenColor(r.totem.lastSeenAt)}`}>
                      {lastSeenLabel(r.totem.lastSeenAt)}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </td>

              {/* Acções */}
              <td className="px-3 py-3 align-top">
                <div className="flex items-center justify-end gap-2">
                  {!r.totem ? (
                    <button
                      type="button"
                      onClick={() => handleCreate(r.court.id)}
                      className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600"
                    >
                      + Criar totem
                    </button>
                  ) : editingId !== r.totem.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditingId(r.totem!.id)}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                      >
                        Renomear
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRegenerate(r.totem!)}
                        className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 transition hover:border-amber-300 hover:bg-amber-100"
                        title="Gera novo token (invalida o anterior)"
                      >
                        ↻ Token
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(r.totem!)}
                        className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 transition hover:border-red-300 hover:bg-red-100"
                      >
                        Apagar
                      </button>
                    </>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
