"use client";

import { useState, useTransition } from "react";
import { deleteUser, renameUser, resetUserPassword } from "./actions";
import { TrashIcon } from "@/components/icons";

export function UserRow({
  id,
  email,
  name,
  createdAt,
  isSelf,
}: {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [resetting, setResetting] = useState(false);

  function onDelete() {
    if (!confirm(`Apagar o utilizador "${name || email}"? Não há volta.`)) return;
    startTransition(() => deleteUser(id));
  }

  return (
    <li
      className={[
        "rounded-xl bg-white p-4 ring-1 ring-slate-200/80 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition",
        pending ? "opacity-50" : "",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold uppercase text-slate-600">
          {(name || email).trim().slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-bold text-slate-900">
              {name || <span className="italic text-slate-400">sem nome</span>}
            </span>
            {isSelf && (
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                tu
              </span>
            )}
          </div>
          <div className="truncate text-xs text-slate-500">{email}</div>
        </div>
        <div className="text-[11px] text-slate-400">
          {new Date(createdAt).toLocaleDateString("pt-PT", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setEditing((v) => !v);
              setResetting(false);
            }}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900"
          >
            Nome
          </button>
          <button
            type="button"
            onClick={() => {
              setResetting((v) => !v);
              setEditing(false);
            }}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900"
          >
            Password
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isSelf || pending}
            title={isSelf ? "Não te podes apagar" : "Apagar utilizador"}
            className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-25"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {editing && (
        <form
          action={renameUser.bind(null, id)}
          className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3"
        >
          <div className="flex-1">
            <label className="mb-1 block text-[11px] font-medium text-slate-500">
              Nome a mostrar
            </label>
            <input
              name="name"
              defaultValue={name}
              autoComplete="off"
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-emerald-500"
          >
            Guardar
          </button>
        </form>
      )}

      {resetting && (
        <form
          action={resetUserPassword.bind(null, id)}
          className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3"
        >
          <div className="flex-1">
            <label className="mb-1 block text-[11px] font-medium text-slate-500">
              Nova password (mín. 6)
            </label>
            <input
              name="password"
              type="text"
              required
              autoComplete="off"
              placeholder="nova password"
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-amber-600"
          >
            Redefinir
          </button>
        </form>
      )}
    </li>
  );
}
