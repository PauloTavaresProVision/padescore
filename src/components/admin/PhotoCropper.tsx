"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

/**
 * Modal de crop interactivo. Usa react-easy-crop para zoom + drag (suporta
 * mouse + touch). Output: blob PNG com o crop aplicado, no aspect 3:4
 * (formato avatar de jogador padel/scoreboard).
 *
 * Uso típico (no SinglePlayerPhotoUpload):
 *   1. Utilizador escolhe foto
 *   2. Mostramos este cropper com a foto original
 *   3. Utilizador arrasta/zooma para focar a parte que quer (cabeça+ombros)
 *   4. Clica em "Aplicar" → onCropped(blob)
 *   5. Esse blob vai depois para o background-removal
 */
export function PhotoCropper({
  sourceUrl,
  aspect = 3 / 4,
  onCropped,
  onCancel,
}: {
  sourceUrl: string;
  aspect?: number;
  onCropped: (croppedBlob: Blob, croppedUrl: string) => void;
  onCancel: () => void;
}) {
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixelArea, setPixelArea] = useState<Area | null>(null);
  const [applying, setApplying] = useState(false);

  const onCropComplete = useCallback((_area: Area, areaPx: Area) => {
    setPixelArea(areaPx);
  }, []);

  async function apply() {
    if (!pixelArea) return;
    setApplying(true);
    try {
      const blob = await cropImageToBlob(sourceUrl, pixelArea);
      const url = URL.createObjectURL(blob);
      onCropped(blob, url);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-950/95 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <h2 className="text-base font-bold text-white">Ajustar a foto</h2>
          <p className="text-xs text-slate-400">
            Arrasta para mover · Roda para zoom · Foca cabeça e ombros
          </p>
        </div>
        <button
          onClick={onCancel}
          disabled={applying}
          className="grid h-9 w-9 place-items-center rounded-lg text-2xl leading-none text-slate-400 transition hover:bg-white/10 hover:text-white"
          aria-label="Cancelar"
        >
          ×
        </button>
      </div>

      {/* Cropper area */}
      <div className="relative flex-1 bg-slate-900">
        <Cropper
          image={sourceUrl}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          objectFit="contain"
          showGrid
          style={{
            containerStyle: { background: "#0f172a" },
            cropAreaStyle: {
              border: "2px solid rgb(16 185 129)",
              boxShadow: "0 0 0 9999px rgba(2,6,23,0.7)",
            },
          }}
        />
      </div>

      {/* Footer (zoom slider + buttons) */}
      <div className="border-t border-white/10 bg-slate-950 px-4 py-3">
        <div className="mx-auto flex max-w-md flex-col gap-3">
          <label className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-slate-300">
            <span>Zoom</span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-emerald-500"
              disabled={applying}
            />
            <span className="w-10 text-right tabular-nums text-slate-400">
              {zoom.toFixed(1)}×
            </span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={applying}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={applying || !pixelArea}
              className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {applying ? "A aplicar..." : "Aplicar crop"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Aplica o crop a uma imagem (URL) usando canvas. Retorna PNG blob.
 * Resolução do output mantém o tamanho original recortado (sem downscale).
 */
async function cropImageToBlob(srcUrl: string, area: Area): Promise<Blob> {
  const img = await loadImage(srcUrl);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(area.width);
  canvas.height = Math.round(area.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context indisponível");
  ctx.drawImage(
    img,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob falhou"))),
      "image/png",
    );
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha a carregar imagem"));
    img.src = url;
  });
}
