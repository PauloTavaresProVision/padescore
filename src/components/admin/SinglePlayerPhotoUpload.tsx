"use client";

import { useEffect, useRef, useState } from "react";
import { detectFacing, type Facing, type FacingResult } from "@/lib/face-direction";
import { PhotoCropper } from "./PhotoCropper";

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

  // Crop step: depois de seleccionar a foto, mostramos cropper INTERACTIVO
  // antes do background-removal. Útil para focar cabeça+ombros (avatar).
  const [cropSrcUrl, setCropSrcUrl] = useState<string | null>(null);
  // Foto original do file picker — guardada para reabrir cropper se quiser
  // re-ajustar o crop sem recarregar o ficheiro
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!bgRemovedBlob || !hiddenRef.current) return;
    const dt = new DataTransfer();
    dt.items.add(new File([bgRemovedBlob], "player.png", { type: "image/png" }));
    hiddenRef.current.files = dt.files;
  }, [bgRemovedBlob]);

  /**
   * Fase 1: utilizador escolhe ficheiro → abrimos o cropper.
   * A detecção facial (IA) corre em paralelo na foto ORIGINAL.
   */
  function onSelect(f: File | null) {
    if (!f) return;
    setError(null);
    setFile(f);
    setBgRemovedBlob(null);
    setBgRemovedUrl(null);
    setFacing(null);

    const url = URL.createObjectURL(f);
    setOriginalUrl(url);
    setPreview(url);
    // Abre cropper para o user ajustar
    setCropSrcUrl(url);

    // Detecção facial (na foto original — mais fiável que na recortada)
    if (detectEnabled && onFacing) {
      setFacing("detecting");
      detectFacing(f)
        .then((r) => {
          setFacing(r);
          onFacing(r.facing === "error" ? "unknown" : r.facing);
        })
        .catch((e) =>
          setFacing({
            facing: "error",
            detail: e instanceof Error ? e.message : "Erro inesperado na IA.",
          }),
        );
    }
  }

  /**
   * Fase 2: utilizador confirmou o crop → corremos background removal
   * SÓ na área recortada (mais rápido e focado).
   */
  async function onCropConfirmed(croppedBlob: Blob, croppedUrl: string) {
    setCropSrcUrl(null); // fecha cropper
    setPreview(croppedUrl); // mostra preview do crop
    setProcessing(true);
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const blob = await removeBackground(croppedBlob, {
        output: { format: "image/png" },
      });
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
    setOriginalUrl(null);
    setCropSrcUrl(null);
    setBgRemovedBlob(null);
    setBgRemovedUrl(null);
    setError(null);
    setFacing(null);
    if (hiddenRef.current) hiddenRef.current.value = "";
  }

  function reCrop() {
    if (originalUrl) setCropSrcUrl(originalUrl);
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
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center gap-4">
        <label
          htmlFor="player-photo-input"
          className="bg-checker group relative grid aspect-[3/4] w-32 cursor-pointer place-items-center overflow-hidden rounded-xl border border-dashed border-slate-300 text-xs text-slate-400 transition hover:border-slate-400"
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
            <div className="absolute inset-0 grid place-items-center bg-white/80 text-center text-[11px] font-semibold uppercase tracking-widest text-emerald-600">
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

        <div className="flex-1 text-xs text-slate-500">
          {bgRemovedBlob ? (
            <>
              <div className="font-semibold text-emerald-600">Foto pronta</div>
              <div className="mt-1">Fundo removido. Vai ser guardada como PNG transparente.</div>
              <div className="mt-2 flex flex-wrap gap-3">
                {originalUrl && (
                  <button
                    type="button"
                    onClick={reCrop}
                    className="font-semibold text-cyan-600 hover:underline"
                  >
                    Re-cropar
                  </button>
                )}
                <button
                  type="button"
                  onClick={reset}
                  className="font-semibold text-emerald-600 hover:underline"
                >
                  Trocar foto
                </button>
              </div>
            </>
          ) : processing ? (
            <div>A correr o modelo de remoção de fundo… (~5-10 s na primeira foto)</div>
          ) : cropSrcUrl ? (
            <div className="font-semibold text-cyan-700">
              A ajustar crop… (vê o ecrã)
            </div>
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
                  ? "border-slate-200 bg-slate-50 text-slate-500"
                  : facingKind === "error"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : facingKind === "unknown"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-cyan-200 bg-cyan-50 text-cyan-700",
              ].join(" ")}
            >
              {facingLabel}
            </div>
          )}
        </div>
      </div>

      <input ref={hiddenRef} type="file" name="photo" className="hidden" />

      {/* Cropper modal — aparece imediatamente após escolher foto, e pode
          ser re-aberto depois com "Re-cropar" */}
      {cropSrcUrl && (
        <PhotoCropper
          sourceUrl={cropSrcUrl}
          aspect={3 / 4}
          onCropped={onCropConfirmed}
          onCancel={() => {
            setCropSrcUrl(null);
            // Se nunca chegou a confirmar um crop e não há nada guardado,
            // limpa tudo (volta ao estado inicial)
            if (!bgRemovedBlob) reset();
          }}
        />
      )}

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
  );
}
