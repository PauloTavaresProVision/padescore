"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface PhotoOption {
  id: string;
  name: string;
  short_name: string | null;
  photo_url: string | null;
}

/**
 * Modal de escolha de foto. Aparece quando o utilizador clica "Escolher foto"
 * num slot do form de criar jogo.
 *
 * - Search por nome (filtra client-side, instant)
 * - Grid de cards (foto + nome). Click → onPick(player) e fecha.
 * - Botão "Remover foto deste jogador" → onPick(null) e fecha.
 *
 * Performance: testado com 500+ players. A grid usa CSS grid + lazy loading
 * nos <img> para não puxar todas as fotos de uma vez.
 */
export function PhotoPickerModal({
  open,
  onClose,
  onPick,
  players,
  currentId,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (player: PhotoOption | null) => void;
  players: PhotoOption[];
  currentId: string | null;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus search on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // ESC fecha
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Click fora fecha
  function onBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.short_name?.toLowerCase().includes(q) ?? false),
    );
  }, [players, query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={onBackdropClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-base font-bold text-slate-900">Escolher foto do jogador</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-slate-100 px-5 py-3">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              🔍
            </span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Procurar jogador..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>
              {filtered.length} de {players.length} jogador{players.length === 1 ? "" : "es"}
            </span>
            {currentId && (
              <button
                type="button"
                onClick={() => {
                  onPick(null);
                  onClose();
                }}
                className="font-semibold text-red-600 transition hover:text-red-700"
              >
                Remover foto deste jogador
              </button>
            )}
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {filtered.length === 0 ? (
            <div className="grid place-items-center py-16 text-sm text-slate-500">
              {players.length === 0 ? (
                <>Ainda não tens jogadores no catálogo.</>
              ) : (
                <>Nenhum jogador encontrado para &ldquo;{query}&rdquo;.</>
              )}
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {filtered.map((p) => {
                const selected = p.id === currentId;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onPick(p);
                        onClose();
                      }}
                      className={[
                        "group flex w-full flex-col overflow-hidden rounded-xl border transition",
                        selected
                          ? "border-emerald-500 ring-2 ring-emerald-500/30"
                          : "border-slate-200 hover:border-slate-300",
                      ].join(" ")}
                    >
                      <div className="bg-checker relative aspect-[3/4] w-full overflow-hidden">
                        {p.photo_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={p.photo_url}
                            alt=""
                            loading="lazy"
                            className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105"
                          />
                        ) : (
                          <div className="grid h-full place-items-center text-2xl font-bold text-slate-400">
                            {p.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        {selected && (
                          <div className="absolute right-1.5 top-1.5 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                            ✓
                          </div>
                        )}
                      </div>
                      <div className="border-t border-slate-100 bg-white px-2 py-1.5 text-left">
                        <div className="truncate text-xs font-bold text-slate-900">{p.name}</div>
                        {p.short_name && (
                          <div className="truncate text-[10px] text-slate-500">{p.short_name}</div>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          <span>ESC para fechar</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900"
          >
            Cancelar
          </button>
        </div>

        <style>{`
          .bg-checker {
            background-image:
              linear-gradient(45deg, #e2e8f0 25%, transparent 25%),
              linear-gradient(-45deg, #e2e8f0 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, #e2e8f0 75%),
              linear-gradient(-45deg, transparent 75%, #e2e8f0 75%);
            background-size: 16px 16px;
            background-position: 0 0, 0 8px, 8px -8px, -8px 0;
            background-color: #f1f5f9;
          }
        `}</style>
      </div>
    </div>
  );
}
