"use client";

import { useEffect, useRef, useState } from "react";
import { detectFacing, type Facing, type FacingResult } from "@/lib/face-direction";

/**
 * Upload de UMA foto individual (jogador). Faz a remoção de fundo com
 * @imgly/background-removal no browser (WebAssembly + ONNX) e
 * preenche um input hidden `photo` com o PNG transparente final.
 *
 * Se `onFacing` for passado, corre também a detecção facial (IA) na foto
 * original e reporta a direcção detectada para o formulário decidir o mirror.
 *
 * Usado em /admin/players/new e /admin/players/[id]/edit.
 */
export function SinglePlayerPhotoUpload({
  onFacing,
  detectEnabled = true,
}: {
  onFacing?: (facing: Facing) => void;
  detectEnabled?: boolean;
} = {}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [bgRemovedBlob, setBgRemovedBlob] = useState<Blob | null>(null);
  const [bgRemovedUrl, setBgRemovedUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<
    FacingResult | "detecting" | null
  >(null);
  const hiddenRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!bgRemovedBlob || !hiddenRef.current) return;
    const dt = new DataTransfer();
    dt.items.add(new File([bgRemovedBlob], "player.png", { type: "image/png" }));
    hiddenRef.current.files = dt.files;
  }, [bgRemovedBlob]);

  async function onSelect(f: File | null) {
    if (!f) return;
    setError(null);
    setFile(f);
    setBgRemovedBlob(null);
    setBgRemovedUrl(null);
    setFacing(null);
    setPreview(URL.createObjectURL(f));
    setProcessing(true);

    // Detecção facial (IA) corre em paralelo com a remoção de fundo, na
    // foto ORIGINAL (mais fiável que na recortada).
    if (detectEnabled && onFacing) {
      setFacing("detecting");
      detectFacing(f)
        .then((r) => {
          setFacing(r);
          // Para o form: "error" não mexe no mirror (igual a unknown).
          onFacing(r.facing === "error" ? "unknown" : r.facing);
        })
        .catch((e) =>
          setFacing({
            facing: "error",
            detail: e instanceof Error ? e.message : "Erro inesperado na IA.",
          }),
        );
    }

    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const blob = await removeBackground(f, { output: { format: "image/png" } });
      setBgRemovedBlob(blob);
      setBgRemovedUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha a remover fundo");
    } finally {
      setProcessing(false);
    }
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setBgRemovedBlob(null);
    setBgRemovedUrl(null);
    setError(null);
    setFacing(null);
    if (hiddenRef.current) hiddenRef.current.value = "";
  }

  const facingKind =
    facing === "detecting"
      ? "detecting"
      : facing === null
        ? null
        : facing.facing; // "left" | "right" | "unknown" | "error"

  const facingLabel =
    facing === "detecting"
      ? "🤖 IA: a analisar direcção…"
      : facing === null
        ? null
        : `🤖 ${facing.detail}`;

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-center gap-4">
        <label
          htmlFor="player-photo-input"
          className="bg-checker group relative grid aspect-[3/4] w-32 cursor-pointer place-items-center overflow-hidden rounded-xl border border-dashed border-slate-700 bg-slate-950/60 text-xs text-slate-500 transition hover:border-slate-600"
        >
          {bgRemovedUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={bgRemovedUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : preview ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={preview}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-50"
            />
          ) : null}
          {processing && (
            <div className="absolute inset-0 grid place-items-center bg-slate-950/70 text-center text-[11px] font-semibold uppercase tracking-widest text-cyan-300">
              A processar
              <br />
              IA…
            </div>
          )}
          {!file && !processing && (
            <div className="text-center">
              + Foto
              <br />
              <span className="text-[10px]">PNG / JPG</span>
            </div>
          )}
          <input
            id="player-photo-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
            className="sr-only"
          />
        </label>

        <div className="flex-1 text-xs text-slate-400">
          {bgRemovedBlob ? (
            <>
              <div className="font-medium text-emerald-400">Foto pronta</div>
              <div className="mt-1">Fundo removido. Vai ser guardada como PNG transparente.</div>
              <button
                type="button"
                onClick={reset}
                className="mt-2 text-cyan-400 hover:underline"
              >
                Trocar foto
              </button>
            </>
          ) : processing ? (
            <div>A correr o modelo de remoção de fundo… (~5-10 s na primeira foto)</div>
          ) : (
            <div>
              Clica na caixa para carregar uma foto. Funciona melhor com fotos
              tipo retrato, fundo simples, jogador visível da cintura para cima.
            </div>
          )}
          {facingLabel && (
            <div
              className={[
                "mt-2 block rounded border px-2 py-1 text-[11px] font-medium",
                facingKind === "detecting"
                  ? "border-slate-700 bg-slate-900 text-slate-400"
                  : facingKind === "error"
                    ? "border-red-500/40 bg-red-500/10 text-red-300"
                    : facingKind === "unknown"
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                      : "border-cyan-500/40 bg-cyan-500/10 text-cyan-200",
              ].join(" ")}
            >
              {facingLabel}
            </div>
          )}
        </div>
      </div>

      <input ref={hiddenRef} type="file" name="photo" className="hidden" />

      <style>{`
        .bg-checker {
          background-image:
            linear-gradient(45deg, #1f2937 25%, transparent 25%),
            linear-gradient(-45deg, #1f2937 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #1f2937 75%),
            linear-gradient(-45deg, transparent 75%, #1f2937 75%);
          background-size: 16px 16px;
          background-position: 0 0, 0 8px, 8px -8px, -8px 0;
          background-color: #0f172a;
        }
      `}</style>
    </div>
  );
}
