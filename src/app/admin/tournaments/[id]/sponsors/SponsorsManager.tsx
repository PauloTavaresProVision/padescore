"use client";

import { useState, useRef } from "react";
import {
  uploadSponsor,
  setKind,
  setDuration,
  reorderSponsors,
  deleteSponsor,
} from "./actions";

export type SponsorKind = "footer" | "fullscreen";
export interface SponsorRow {
  id: string;
  imageUrl: string;
  kind: SponsorKind;
  durationSec: number;
  sortOrder: number;
}

export function SponsorsManager({
  tournamentId,
  initialSponsors,
}: {
  tournamentId: string;
  initialSponsors: SponsorRow[];
}) {
  const [sponsors, setSponsors] = useState(initialSponsors);
  const [uploading, setUploading] = useState(false);
  const [uploadKind, setUploadKind] = useState<SponsorKind>("footer");
  const fileRef = useRef<HTMLInputElement>(null);

  // Resync se a lista do servidor mudou (após server actions com revalidate)
  const initialKey = initialSponsors
    .map((s) => `${s.id}:${s.kind}:${s.sortOrder}:${s.durationSec}`)
    .join("|");
  const currentKey = sponsors
    .map((s) => `${s.id}:${s.kind}:${s.sortOrder}:${s.durationSec}`)
    .join("|");
  if (initialKey !== currentKey && initialSponsors.length !== sponsors.length) {
    setSponsors(initialSponsors);
  }

  const footer = sponsors
    .filter((s) => s.kind === "footer")
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const fullscreen = sponsors
    .filter((s) => s.kind === "fullscreen")
    .sort((a, b) => a.sortOrder - b.sortOrder);

  async function handleUpload(formData: FormData) {
    setUploading(true);
    try {
      await uploadSponsor(tournamentId, formData);
      if (fileRef.current) fileRef.current.value = "";
    } finally {
      setUploading(false);
    }
  }

  async function moveInList(kind: SponsorKind, id: string, dir: -1 | 1) {
    const list = (kind === "footer" ? footer : fullscreen).map((s) => s.id);
    const idx = list.indexOf(id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= list.length) return;
    [list[idx], list[newIdx]] = [list[newIdx], list[idx]];
    // Optimistic local: actualiza sortOrder dentro do kind
    setSponsors((prev) =>
      prev.map((s) => {
        if (s.kind !== kind) return s;
        const newIdx2 = list.indexOf(s.id);
        return newIdx2 === -1 ? s : { ...s, sortOrder: newIdx2 };
      }),
    );
    await reorderSponsors(tournamentId, kind, list);
  }

  async function handleSetKind(s: SponsorRow, newKind: SponsorKind) {
    if (s.kind === newKind) return;
    await setKind(tournamentId, s.id, newKind);
  }

  async function handleSetDuration(s: SponsorRow, dur: number) {
    if (dur === s.durationSec) return;
    const fd = new FormData();
    fd.set("duration_sec", String(dur));
    await setDuration(tournamentId, s.id, fd);
  }

  async function handleDelete(s: SponsorRow) {
    if (!confirm("Apagar este sponsor?")) return;
    await deleteSponsor(tournamentId, s.id);
  }

  return (
    <div className="space-y-6">
      {/* Upload */}
      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-700">
          Adicionar sponsor
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          PNG/JPG/SVG, máx 8 MB. Logos do footer usam fundo transparente
          (PNG/SVG) para integrarem bem com a barra escura do totem.
        </p>
        <form action={handleUpload} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
            <input
              ref={fileRef}
              type="file"
              name="file"
              required
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-white text-sm text-slate-500 outline-none transition hover:border-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 file:mr-3 file:cursor-pointer file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            />
            <select
              name="kind"
              value={uploadKind}
              onChange={(e) => setUploadKind(e.target.value as SponsorKind)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none transition hover:border-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
            >
              <option value="footer">Footer</option>
              <option value="fullscreen">Fullscreen</option>
            </select>
            {uploadKind === "fullscreen" ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  name="duration_sec"
                  defaultValue={8}
                  min={2}
                  max={60}
                  className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-700 outline-none transition hover:border-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                />
                <span className="text-sm text-slate-500">seg</span>
              </div>
            ) : (
              <input type="hidden" name="duration_sec" value="8" />
            )}
            <button
              type="submit"
              disabled={uploading}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
            >
              {uploading ? "A enviar..." : "Upload"}
            </button>
          </div>
        </form>
      </div>

      {/* Footer sponsors */}
      <SponsorSection
        title="Footer"
        subtitle="Logos pequenos sempre visíveis no rodapé do totem."
        list={footer}
        onMove={(id, dir) => moveInList("footer", id, dir)}
        onSetKind={handleSetKind}
        onSetDuration={handleSetDuration}
        onDelete={handleDelete}
      />

      {/* Fullscreen sponsors */}
      <SponsorSection
        title="Fullscreen"
        subtitle="Imagens grandes em rotação entre conteúdo do jogo. Cada uma fica visível pelo nº de segundos configurado."
        list={fullscreen}
        onMove={(id, dir) => moveInList("fullscreen", id, dir)}
        onSetKind={handleSetKind}
        onSetDuration={handleSetDuration}
        onDelete={handleDelete}
      />
    </div>
  );
}

function SponsorSection({
  title,
  subtitle,
  list,
  onMove,
  onSetKind,
  onSetDuration,
  onDelete,
}: {
  title: string;
  subtitle: string;
  list: SponsorRow[];
  onMove: (id: string, dir: -1 | 1) => void;
  onSetKind: (s: SponsorRow, kind: SponsorKind) => void;
  onSetDuration: (s: SponsorRow, dur: number) => void;
  onDelete: (s: SponsorRow) => void;
}) {
  const isFullscreen = list[0]?.kind === "fullscreen";
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
        </div>
        <span className="text-xs font-medium text-slate-500">
          {list.length === 0
            ? "vazio"
            : list.length === 1
              ? "1 imagem"
              : `${list.length} imagens`}
        </span>
      </div>

      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
          Sem imagens deste tipo. Faz upload acima e escolhe &ldquo;
          {title.toLowerCase()}&rdquo;.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((s, i) => (
            <li
              key={s.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
            >
              {/* Thumbnail */}
              <div
                className={`grid place-items-center ${isFullscreen ? "aspect-video" : "aspect-[3/1]"} bg-[linear-gradient(135deg,#e2e8f0_25%,transparent_25%),linear-gradient(225deg,#e2e8f0_25%,transparent_25%),linear-gradient(45deg,#e2e8f0_25%,transparent_25%),linear-gradient(315deg,#e2e8f0_25%,#f1f5f9_25%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0]`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.imageUrl}
                  alt=""
                  className="max-h-full max-w-full object-contain p-2"
                />
              </div>

              {/* Controls */}
              <div className="space-y-2 p-3">
                <div className="flex items-center gap-2">
                  <div className="flex shrink-0 gap-0.5">
                    <button
                      type="button"
                      onClick={() => onMove(s.id, -1)}
                      disabled={i === 0}
                      className="grid h-6 w-6 place-items-center rounded text-slate-400 transition hover:bg-slate-200 hover:text-slate-900 disabled:opacity-30"
                      title="Subir"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => onMove(s.id, 1)}
                      disabled={i === list.length - 1}
                      className="grid h-6 w-6 place-items-center rounded text-slate-400 transition hover:bg-slate-200 hover:text-slate-900 disabled:opacity-30"
                      title="Descer"
                    >
                      ▼
                    </button>
                  </div>
                  <span className="text-xs text-slate-500">#{i + 1}</span>
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => onDelete(s)}
                    className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 transition hover:border-red-300 hover:bg-red-100"
                  >
                    Apagar
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={s.kind}
                    onChange={(e) => onSetKind(s, e.target.value as SponsorKind)}
                    className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                  >
                    <option value="footer">Footer</option>
                    <option value="fullscreen">Fullscreen</option>
                  </select>

                  {s.kind === "fullscreen" && (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        defaultValue={s.durationSec}
                        min={2}
                        max={60}
                        onBlur={(e) => {
                          const v = Number(e.currentTarget.value);
                          if (Number.isFinite(v)) onSetDuration(s, v);
                        }}
                        className="w-14 rounded border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                      />
                      <span className="text-xs text-slate-500">seg</span>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
