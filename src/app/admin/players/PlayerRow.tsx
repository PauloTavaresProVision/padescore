"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deletePlayer, toggleMirror } from "./actions";
import { TrashIcon } from "@/components/icons";
import { deriveShortName } from "@/lib/names";

interface Player {
  id: string;
  name: string;
  short_name: string | null;
  photo_url: string | null;
  mirror: boolean;
}

export function PlayerRow({ player }: { player: Player }) {
  const [pending, startTransition] = useTransition();
  const [mirror, setMirror] = useState(player.mirror);

  function onToggleMirror() {
    const next = !mirror;
    setMirror(next);
    startTransition(() => toggleMirror(player.id, next));
  }

  function onDelete() {
    if (!confirm(`Apagar "${player.name}"?`)) return;
    startTransition(() => deletePlayer(player.id));
  }

  return (
    <li
      className={[
        "group relative flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-200/80 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition",
        pending ? "opacity-50" : "hover:ring-slate-300 hover:shadow-md",
      ].join(" ")}
    >
      <div className="bg-checker grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg ring-1 ring-slate-200">
        {player.photo_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={player.photo_url}
            alt=""
            className="h-full w-full object-cover"
            style={{ transform: mirror ? "scaleX(-1)" : undefined }}
          />
        ) : (
          <span className="text-lg font-bold text-slate-400">
            {player.name.slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-slate-900">{player.name}</div>
        <div className="truncate text-[11px] text-slate-500">
          OBS:{" "}
          <span
            className={player.short_name ? "text-slate-600" : "italic text-slate-400"}
            title={
              player.short_name
                ? undefined
                : "Derivado automaticamente — edita para personalizar"
            }
          >
            {player.short_name ?? deriveShortName(player.name)}
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleMirror}
          disabled={pending}
          className={[
            "mt-1 inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition",
            mirror
              ? "border-cyan-300 bg-cyan-50 text-cyan-700"
              : "border-slate-300 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-700",
          ].join(" ")}
          title="Espelhar foto"
        >
          🔄 {mirror ? "Espelhada" : "Espelhar"}
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <Link
          href={`/admin/players/${player.id}/edit`}
          className="grid h-8 w-8 place-items-center rounded-lg border border-slate-300 bg-white text-slate-500 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900"
          title="Editar jogador"
        >
          <PencilIcon className="h-4 w-4" />
        </Link>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:opacity-50"
          title="Apagar jogador"
        >
          <TrashIcon className="h-4 w-4" />
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
    </li>
  );
}

function PencilIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}
