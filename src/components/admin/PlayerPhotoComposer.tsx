"use client";

import { useEffect, useRef, useState } from "react";

type Slot = "a1" | "a2" | "b1" | "b2";

interface SlotState {
  file: File | null;
  preview: string | null;
  bgRemoved: Blob | null;
  mirror: boolean;
}

interface ComposeResult {
  teamA: Blob | null;
  teamB: Blob | null;
}

/**
 * Upload de 4 fotos individuais, remove fundo via @imgly/background-removal
 * (WebAssembly no browser), compõe 2 PNGs transparentes (Dupla A e Dupla B)
 * e preenche inputs hidden `team_a_photo` / `team_b_photo` no formulário.
 *
 * Cada slot tem um botão "Espelhar" — útil quando o jogador foi fotografado
 * a olhar para o lado errado.
 */
export function PlayerPhotoComposer() {
  const [slots, setSlots] = useState<Record<Slot, SlotState>>({
    a1: empty(),
    a2: empty(),
    b1: empty(),
    b2: empty(),
  });
  const [compose, setCompose] = useState<ComposeResult>({ teamA: null, teamB: null });
  const [composeUrls, setComposeUrls] = useState<{ a: string | null; b: string | null }>({
    a: null,
    b: null,
  });
  const [processing, setProcessing] = useState<Slot | "compose" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const teamAInputRef = useRef<HTMLInputElement>(null);
  const teamBInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (compose.teamA && teamAInputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(new File([compose.teamA], "team_a_composite.png", { type: "image/png" }));
      teamAInputRef.current.files = dt.files;
    }
    if (compose.teamB && teamBInputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(new File([compose.teamB], "team_b_composite.png", { type: "image/png" }));
      teamBInputRef.current.files = dt.files;
    }
  }, [compose]);

  async function onFileSelected(slot: Slot, file: File | null) {
    if (!file) return;
    setError(null);
    const preview = URL.createObjectURL(file);
    setSlots((s) => ({
      ...s,
      [slot]: { ...s[slot], file, preview, bgRemoved: null },
    }));

    setProcessing(slot);
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const result = await removeBackground(file, { output: { format: "image/png" } });
      setSlots((s) => ({
        ...s,
        [slot]: { ...s[slot], bgRemoved: result },
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao remover fundo");
    } finally {
      setProcessing(null);
    }
  }

  function toggleMirror(slot: Slot) {
    setSlots((s) => ({
      ...s,
      [slot]: { ...s[slot], mirror: !s[slot].mirror },
    }));
    // Limpa composites antigos para o user reconstruir
    setCompose({ teamA: null, teamB: null });
    setComposeUrls({ a: null, b: null });
  }

  function removeSlot(slot: Slot) {
    setSlots((s) => ({ ...s, [slot]: empty() }));
    setCompose({ teamA: null, teamB: null });
    setComposeUrls({ a: null, b: null });
  }

  async function buildComposites() {
    setError(null);
    setProcessing("compose");
    try {
      const teamA = slots.a1.bgRemoved || slots.a2.bgRemoved
        ? await composeTeam(
            [
              slots.a1.bgRemoved
                ? { blob: slots.a1.bgRemoved, mirror: slots.a1.mirror }
                : null,
              slots.a2.bgRemoved
                ? { blob: slots.a2.bgRemoved, mirror: slots.a2.mirror }
                : null,
            ],
            "left-to-right",
          )
        : null;
      const teamB = slots.b1.bgRemoved || slots.b2.bgRemoved
        ? await composeTeam(
            [
              slots.b1.bgRemoved
                ? { blob: slots.b1.bgRemoved, mirror: slots.b1.mirror }
                : null,
              slots.b2.bgRemoved
                ? { blob: slots.b2.bgRemoved, mirror: slots.b2.mirror }
                : null,
            ],
            "right-to-left",
          )
        : null;
      setCompose({ teamA, teamB });
      setComposeUrls({
        a: teamA ? URL.createObjectURL(teamA) : null,
        b: teamB ? URL.createObjectURL(teamB) : null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na composição");
    } finally {
      setProcessing(null);
    }
  }

  const anyBgDone = (Object.values(slots) as SlotState[]).some(
    (s) => s.bgRemoved !== null,
  );
  const allReady =
    Object.values(slots).every((s) => s.file === null || s.bgRemoved !== null) &&
    anyBgDone;

  return (
    <div className="space-y-4 rounded-2xl border border-slate-800/80 bg-slate-900/30 p-5">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Fotos dos jogadores (IA)
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Carrega uma foto individual de cada jogador. A IA remove o fundo
          automaticamente. Usa o botão{" "}
          <span className="text-cyan-400">🔄 Espelhar</span> em cada foto se o
          jogador estiver virado para o lado errado. Depois clica{" "}
          <span className="text-emerald-400">Compor duplas</span> para gerar a
          imagem final.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <TeamSlots
          color="#10b981"
          label="Dupla A — viram para a direita"
          slots={[
            { id: "a1", state: slots.a1, processing: processing === "a1" },
            { id: "a2", state: slots.a2, processing: processing === "a2" },
          ]}
          onSelect={onFileSelected}
          onToggleMirror={toggleMirror}
          onRemove={removeSlot}
        />
        <TeamSlots
          color="#06b6d4"
          label="Dupla B — viram para a esquerda"
          slots={[
            { id: "b1", state: slots.b1, processing: processing === "b1" },
            { id: "b2", state: slots.b2, processing: processing === "b2" },
          ]}
          onSelect={onFileSelected}
          onToggleMirror={toggleMirror}
          onRemove={removeSlot}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={buildComposites}
          disabled={!allReady || processing !== null}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {processing === "compose" ? "A compor..." : "Compor duplas"}
        </button>
        {processing && processing !== "compose" && (
          <span className="text-xs text-cyan-400">A remover fundo…</span>
        )}
      </div>

      {(composeUrls.a || composeUrls.b) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {composeUrls.a && (
            <PreviewCard label="Composite Dupla A" url={composeUrls.a} />
          )}
          {composeUrls.b && (
            <PreviewCard label="Composite Dupla B" url={composeUrls.b} />
          )}
        </div>
      )}

      <input ref={teamAInputRef} type="file" name="team_a_photo" className="hidden" />
      <input ref={teamBInputRef} type="file" name="team_b_photo" className="hidden" />

      <style>{`
        .bg-checker {
          background-image:
            linear-gradient(45deg, #1f2937 25%, transparent 25%),
            linear-gradient(-45deg, #1f2937 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #1f2937 75%),
            linear-gradient(-45deg, transparent 75%, #1f2937 75%);
          background-size: 20px 20px;
          background-position: 0 0, 0 10px, 10px -10px, -10px 0;
          background-color: #0f172a;
        }
      `}</style>
    </div>
  );
}

function PreviewCard({ label, url }: { label: string; url: string }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
        {label}
      </div>
      <div className="bg-checker overflow-hidden rounded-lg border border-slate-700">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="block w-full" />
      </div>
    </div>
  );
}

function TeamSlots({
  color,
  label,
  slots,
  onSelect,
  onToggleMirror,
  onRemove,
}: {
  color: string;
  label: string;
  slots: { id: Slot; state: SlotState; processing: boolean }[];
  onSelect: (id: Slot, file: File | null) => void;
  onToggleMirror: (id: Slot) => void;
  onRemove: (id: Slot) => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-800/80 bg-slate-950/30 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        {label}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {slots.map(({ id, state, processing }) => (
          <SlotUpload
            key={id}
            id={id}
            state={state}
            processing={processing}
            onSelect={(f) => onSelect(id, f)}
            onToggleMirror={() => onToggleMirror(id)}
            onRemove={() => onRemove(id)}
          />
        ))}
      </div>
    </div>
  );
}

function SlotUpload({
  id,
  state,
  processing,
  onSelect,
  onToggleMirror,
  onRemove,
}: {
  id: Slot;
  state: SlotState;
  processing: boolean;
  onSelect: (f: File | null) => void;
  onToggleMirror: () => void;
  onRemove: () => void;
}) {
  const inputId = `slot-${id}`;
  const bgRemovedUrl = state.bgRemoved
    ? URL.createObjectURL(state.bgRemoved)
    : null;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={inputId}
        className="group relative flex aspect-[3/4] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-700 bg-slate-950/60 text-xs text-slate-500 transition hover:border-slate-600"
      >
        {bgRemovedUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={bgRemovedUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-contain"
            style={{
              transform: state.mirror ? "scaleX(-1)" : undefined,
            }}
          />
        ) : state.preview ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={state.preview}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-60"
          />
        ) : null}
        {processing && (
          <div className="absolute inset-0 grid place-items-center bg-slate-950/70 text-center text-[11px] font-semibold uppercase tracking-widest text-cyan-300">
            A processar
            <br />
            IA…
          </div>
        )}
        {!state.file && !processing && (
          <div className="text-center">
            + foto
            <br />
            <span className="text-[10px]">jogador {id.endsWith("1") ? "1" : "2"}</span>
          </div>
        )}
        <input
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
          className="sr-only"
        />
      </label>
      {state.bgRemoved && (
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onToggleMirror}
            className={[
              "flex-1 rounded border px-2 py-1 text-[10px] font-medium uppercase tracking-wider transition",
              state.mirror
                ? "border-cyan-500/60 bg-cyan-500/20 text-cyan-200"
                : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600",
            ].join(" ")}
            title="Espelhar imagem horizontalmente"
          >
            🔄 {state.mirror ? "Espelhada" : "Espelhar"}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[10px] text-red-300 hover:bg-red-500/20"
            title="Remover foto"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composição com canvas (transparente) + mirror per-image
// ---------------------------------------------------------------------------
async function composeTeam(
  inputs: ({ blob: Blob; mirror: boolean } | null)[],
  direction: "left-to-right" | "right-to-left",
): Promise<Blob> {
  const players = (
    await Promise.all(
      inputs.map(async (i) =>
        i ? { img: await loadImage(i.blob), mirror: i.mirror } : null,
      ),
    )
  ).filter((p): p is { img: HTMLImageElement; mirror: boolean } => p !== null);

  if (players.length === 0) throw new Error("Sem imagens para compor");

  const targetHeight = 1000;
  const targetWidth = 1500;

  // Para "right-to-left", inverte a ordem de desenho.
  const drawOrder = direction === "right-to-left" ? [...players].reverse() : players;

  // 1) Escala cada jogador para a altura alvo (mantém aspect ratio).
  const scaled = drawOrder.map((p) => {
    const scale = targetHeight / p.img.height;
    return { ...p, w: p.img.width * scale, h: targetHeight };
  });

  // 2) Cada par "abraça" — sobrepõem 35% da largura do mais estreito.
  //    Quanto maior, mais juntos. 0.35 = bem juntos sem fundir cabeças.
  const overlapFrac = 0.35;
  const totalW =
    scaled.length === 1
      ? scaled[0].w
      : scaled.reduce(
          (acc, s, i) => acc + (i === 0 ? s.w : s.w * (1 - overlapFrac)),
          0,
        );

  // 3) Se totalW > targetWidth, encolhe tudo proporcionalmente para caber.
  const fitScale = totalW > targetWidth ? targetWidth / totalW : 1;
  scaled.forEach((s) => {
    s.w *= fitScale;
    s.h *= fitScale;
  });
  const finalTotalW = totalW * fitScale;

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, targetWidth, targetHeight);

  // 4) Centra o conjunto horizontalmente.
  let x = (targetWidth - finalTotalW) / 2;

  scaled.forEach((p, i) => {
    const { img, mirror, w, h } = p;
    const drawX = x;
    const drawY = targetHeight - h; // bottom-aligned (mantém cabeças visíveis)

    if (mirror) {
      ctx.save();
      ctx.translate(drawX + w, drawY);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(img, drawX, drawY, w, h);
    }

    // Avança para o próximo, descontando o overlap.
    if (i < scaled.length - 1) {
      x += w * (1 - overlapFrac);
    }
  });

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Falha no toBlob"))),
      "image/png",
    );
  });
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Falha a carregar imagem"));
    };
    img.src = url;
  });
}

function empty(): SlotState {
  return { file: null, preview: null, bgRemoved: null, mirror: false };
}
