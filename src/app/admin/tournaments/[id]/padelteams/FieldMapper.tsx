"use client";

import { useState, useTransition } from "react";
import type { PadelTeamsField } from "@/lib/padelteams/client";
import { setCourtFieldId } from "./actions";

interface Court {
  id: string;
  name: string;
  sort_order: number;
  padelteams_field_id: number | null;
}

export function FieldMapper({
  tournamentId,
  courts,
  padelteamsFields,
}: {
  tournamentId: string;
  courts: Court[];
  padelteamsFields: PadelTeamsField[];
}) {
  const [pending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);

  // Que padelteams_field_ids já estão usados (excepto o que seleccionamos
  // agora) → para evitar duplicados no dropdown.
  const usedFieldIds = new Set(
    courts.map((c) => c.padelteams_field_id).filter(Boolean) as number[],
  );

  function handleChange(courtId: string, value: string) {
    const newId = value === "" ? null : parseInt(value, 10);
    setSavingId(courtId);
    startTransition(async () => {
      try {
        await setCourtFieldId(tournamentId, courtId, newId);
      } finally {
        setSavingId(null);
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th className="w-12 px-3 py-2 text-left font-semibold">#</th>
            <th className="px-3 py-2 text-left font-semibold">
              Nosso campo
            </th>
            <th className="w-8 text-center text-slate-300">→</th>
            <th className="px-3 py-2 text-left font-semibold">
              Campo no PadelTeams
            </th>
            <th className="w-32 px-3 py-2 text-right font-semibold">
              Estado
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {courts.map((court) => {
            const isLinked = court.padelteams_field_id !== null;
            const isSaving = pending && savingId === court.id;

            return (
              <tr key={court.id} className="hover:bg-slate-50">
                <td className="px-3 py-3 align-middle text-xs text-slate-400">
                  {court.sort_order}
                </td>
                <td className="px-3 py-3 align-middle font-semibold text-slate-900">
                  {court.name}
                </td>
                <td className="text-center text-slate-300">→</td>
                <td className="px-3 py-3 align-middle">
                  <select
                    value={court.padelteams_field_id ?? ""}
                    onChange={(e) => handleChange(court.id, e.target.value)}
                    disabled={isSaving}
                    className={`w-full rounded border px-2 py-1.5 text-sm transition focus:outline-none focus:ring-2 ${
                      isLinked
                        ? "border-emerald-300 bg-emerald-50/40 text-emerald-900 focus:ring-emerald-500/20"
                        : "border-slate-300 bg-white text-slate-700 focus:ring-slate-500/20"
                    } ${isSaving ? "opacity-50" : ""}`}
                  >
                    <option value="">— Não associado —</option>
                    {padelteamsFields.map((f) => {
                      const usedByOther =
                        usedFieldIds.has(f.id) &&
                        f.id !== court.padelteams_field_id;
                      return (
                        <option
                          key={f.id}
                          value={f.id}
                          disabled={usedByOther}
                        >
                          {f.name} ({f.description}){" "}
                          {usedByOther ? "— já usado" : ""}
                        </option>
                      );
                    })}
                  </select>
                </td>
                <td className="px-3 py-3 align-middle text-right">
                  {isSaving ? (
                    <span className="text-xs text-slate-400">a gravar…</span>
                  ) : isLinked ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      associado
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600">
                      em falta
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {padelteamsFields.length === 0 && (
        <div className="border-t border-slate-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Nenhum campo encontrado no PadelTeams. O torneio ainda não tem
          jogos com campo atribuído (ou tu não tens permissões).
        </div>
      )}
    </div>
  );
}
