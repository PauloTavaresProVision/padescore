"use client";

import { useEffect, useState, useTransition } from "react";
import {
  createCavalete,
  setCavaleteCourts,
  regenerateToken,
  renameTotem,
  deleteTotem,
} from "./actions";

interface Court {
  id: string;
  name: string;
  sort_order: number;
}

interface Cavalete {
  id: string;
  name: string;
  apiToken: string;
  apiUrl: string;
  lastSeenAt: string | null;
  court1: Court | null;
  court2: Court | null;
}

export function CavaletesManager({
  tournamentId,
  courts,
  cavaletes,
}: {
  tournamentId: string;
  courts: Court[];
  cavaletes: Cavalete[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(cavaletes.length === 0);
  const [, force] = useState({});
  useEffect(() => {
    const id = setInterval(() => force({}), 20_000);
    return () => clearInterval(id);
  }, []);

  // Campos já atribuídos a algum cavalete (não devem aparecer no "add")
  const usedCourtIds = new Set<string>();
  for (const c of cavaletes) {
    if (c.court1) usedCourtIds.add(c.court1.id);
    if (c.court2) usedCourtIds.add(c.court2.id);
  }
  const availableCourts = courts.filter((c) => !usedCourtIds.has(c.id));

  async function copy(text: string, id: string) {
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        window.isSecureContext
      ) {
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

  function lastSeenStatus(iso: string | null) {
    if (!iso) {
      return {
        dot: "bg-slate-300",
        text: "text-slate-400",
        label: "Nunca",
        pulse: false,
      };
    }
    const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (sec < 60)
      return {
        dot: "bg-emerald-500",
        text: "text-emerald-600",
        label: "agora",
        pulse: true,
      };
    if (sec < 120)
      return {
        dot: "bg-emerald-500",
        text: "text-emerald-600",
        label: `há ${Math.floor(sec / 60)}m`,
        pulse: false,
      };
    if (sec < 600)
      return {
        dot: "bg-amber-500",
        text: "text-amber-600",
        label: `há ${Math.floor(sec / 60)}m`,
        pulse: false,
      };
    if (sec < 3600)
      return {
        dot: "bg-red-500",
        text: "text-red-600",
        label: `há ${Math.floor(sec / 60)}m`,
        pulse: false,
      };
    if (sec < 86400)
      return {
        dot: "bg-red-500",
        text: "text-red-600",
        label: `há ${Math.floor(sec / 3600)}h`,
        pulse: false,
      };
    return {
      dot: "bg-red-500",
      text: "text-red-600",
      label: `há ${Math.floor(sec / 86400)}d`,
      pulse: false,
    };
  }

  return (
    <div>
      {/* Lista de cavaletes existentes */}
      {cavaletes.length > 0 && (
        <div className="mb-4 space-y-3">
          {cavaletes.map((cv) => (
            <CavaleteRow
              key={cv.id}
              tournamentId={tournamentId}
              cavalete={cv}
              courts={courts}
              isEditing={editingId === cv.id}
              onEdit={() => setEditingId(cv.id)}
              onCancelEdit={() => setEditingId(null)}
              onCopy={copy}
              copiedId={copiedId}
              status={lastSeenStatus(cv.lastSeenAt)}
            />
          ))}
        </div>
      )}

      {/* Form para criar novo */}
      {showAdd ? (
        <NewCavaleteForm
          tournamentId={tournamentId}
          availableCourts={availableCourts}
          onCancel={() => setShowAdd(false)}
        />
      ) : (
        availableCourts.length > 0 && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="w-full rounded-lg border-2 border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-emerald-400 hover:bg-emerald-50/30 hover:text-emerald-700"
          >
            + Adicionar cavalete
          </button>
        )
      )}

      {cavaletes.length > 0 && availableCourts.length === 0 && !showAdd && (
        <p className="mt-3 text-center text-xs text-slate-400">
          Todos os {courts.length} campos já estão atribuídos a cavaletes.
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Componente: linha de um cavalete existente
// ============================================================================
function CavaleteRow({
  tournamentId,
  cavalete,
  courts,
  isEditing,
  onEdit,
  onCancelEdit,
  onCopy,
  copiedId,
  status,
}: {
  tournamentId: string;
  cavalete: Cavalete;
  courts: Court[];
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onCopy: (text: string, id: string) => void;
  copiedId: string | null;
  status: { dot: string; text: string; label: string; pulse: boolean };
}) {
  const [pending, startTransition] = useTransition();

  async function handleSave(formData: FormData) {
    const newName = String(formData.get("name") ?? "").trim();
    const newC1 = String(formData.get("court_id_1") ?? "");
    const newC2Raw = String(formData.get("court_id_2") ?? "");
    const newC2 = newC2Raw || null;
    if (!newC1) return;

    startTransition(async () => {
      try {
        if (newName && newName !== cavalete.name) {
          const fd = new FormData();
          fd.append("name", newName);
          await renameTotem(tournamentId, cavalete.id, fd);
        }
        if (
          newC1 !== cavalete.court1?.id ||
          newC2 !== (cavalete.court2?.id ?? null)
        ) {
          await setCavaleteCourts(tournamentId, cavalete.id, newC1, newC2);
        }
      } finally {
        onCancelEdit();
      }
    });
  }

  async function handleRegenerate() {
    if (
      !confirm(
        `Gerar NOVO token para "${cavalete.name}"?\n\nO token actual deixa de funcionar — a app Windows deste cavalete terá de ser reconfigurada.`,
      )
    )
      return;
    await regenerateToken(tournamentId, cavalete.id);
  }

  async function handleDelete() {
    if (
      !confirm(
        `Apagar o cavalete "${cavalete.name}"?\n\nA app Windows deste cavalete deixa de funcionar.`,
      )
    )
      return;
    await deleteTotem(tournamentId, cavalete.id);
  }

  if (isEditing) {
    return (
      <form
        action={handleSave}
        className="rounded-lg border border-emerald-300 bg-emerald-50/30 p-4"
      >
        <div className="mb-3">
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">
            Nome
          </label>
          <input
            type="text"
            name="name"
            defaultValue={cavalete.name}
            required
            maxLength={80}
            className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">
              Campo 1
            </label>
            <select
              name="court_id_1"
              defaultValue={cavalete.court1?.id ?? ""}
              required
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="">— Escolher —</option>
              {courts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">
              Campo 2 (opcional)
            </label>
            <select
              name="court_id_2"
              defaultValue={cavalete.court2?.id ?? ""}
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="">— Nenhum (cavalete só 1 campo) —</option>
              {courts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancelEdit}
            disabled={pending}
            className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {pending ? "A guardar…" : "Guardar"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-[180px] flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">
              {cavalete.name}
            </h3>
            <div className="flex items-center gap-1.5">
              <span className="relative inline-flex h-2 w-2">
                {status.pulse && (
                  <span
                    className={`absolute inline-flex h-full w-full animate-ping rounded-full ${status.dot} opacity-60`}
                  />
                )}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${status.dot}`}
                />
              </span>
              <span className={`text-xs ${status.text}`}>
                {status.label}
              </span>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {cavalete.court1 && (
              <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-800">
                {cavalete.court1.name}
              </span>
            )}
            {cavalete.court2 && (
              <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-800">
                {cavalete.court2.name}
              </span>
            )}
            {!cavalete.court1 && !cavalete.court2 && (
              <span className="text-xs italic text-slate-400">
                sem campos atribuídos
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <code className="block rounded bg-slate-100 px-2 py-1 font-mono text-sm tracking-wider text-slate-900">
              {cavalete.apiToken}
            </code>
            <button
              type="button"
              onClick={() => onCopy(cavalete.apiToken, cavalete.id)}
              className={`rounded border px-2 py-1 text-xs font-medium transition ${
                copiedId === cavalete.id
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
              }`}
            >
              {copiedId === cavalete.id ? "✓ Copiado" : "Copiar token"}
            </button>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={handleRegenerate}
            className="rounded border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:border-amber-300 hover:bg-amber-100"
            title="Gera novo token (invalida o anterior)"
          >
            ↻ Token
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:border-red-300 hover:bg-red-100"
          >
            Apagar
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Componente: form de criação
// ============================================================================
function NewCavaleteForm({
  tournamentId,
  availableCourts,
  onCancel,
}: {
  tournamentId: string;
  availableCourts: Court[];
  onCancel: () => void;
}) {
  return (
    <form
      action={createCavalete.bind(null, tournamentId)}
      className="rounded-lg border-2 border-emerald-300 bg-emerald-50/30 p-4"
    >
      <h3 className="mb-3 text-sm font-bold text-emerald-900">
        Novo cavalete
      </h3>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">
            Campo 1 (obrigatório)
          </label>
          <select
            name="court_id_1"
            required
            defaultValue=""
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="" disabled>
              — Escolher —
            </option>
            {availableCourts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">
            Campo 2 (opcional)
          </label>
          <select
            name="court_id_2"
            defaultValue=""
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="">— Sem segundo campo —</option>
            {availableCourts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-3">
        <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">
          Nome (opcional — se vazio, sugiro um automático)
        </label>
        <input
          type="text"
          name="name"
          placeholder="Cavalete CAMPO X + CAMPO Y"
          maxLength={80}
          className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
        >
          Criar cavalete
        </button>
      </div>
    </form>
  );
}
