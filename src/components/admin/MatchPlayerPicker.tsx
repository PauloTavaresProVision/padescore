"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PhotoPickerModal, type PhotoOption } from "./PhotoPickerModal";
import { deriveShortName } from "@/lib/names";
import { detectFaceBox, type FaceBox } from "@/lib/face-direction";

export interface PlayerOption {
  id: string;
  name: string;
  short_name: string | null;
  photo_url: string | null;
  mirror: boolean;
}

type Slot = "a1" | "a2" | "b1" | "b2";

interface SlotState {
  /** Vai para matches.team_*_player* — o nome longo (TV). */
  name: string;
  /** Vai para matches.team_*_player*_short — o nome curto (OBS). */
  shortName: string;
  /** True enquanto o user não tocou no shortName — então deriva automaticamente. */
  shortAuto: boolean;
  /** FK opcional para players.id — só usado para localizar a foto. */
  playerId: string | null;
  /** Foto descarregada do catálogo. */
  photoBlob: Blob | null;
  /** Aplicar mirror na composição. */
  mirror: boolean;
}

interface ComposeResult {
  teamA: Blob | null;
  teamB: Blob | null;
}

/** Valores iniciais por slot (modo edição de um jogo já criado). */
export interface InitialSlot {
  name: string;
  shortName: string;
  playerId: string | null;
}
export interface InitialData {
  a1: InitialSlot;
  a2: InitialSlot;
  b1: InitialSlot;
  b2: InitialSlot;
  /** Se o jogo já tem composites (team_*_photo_url) guardados. */
  hasComposites: boolean;
}

const TEAM_CONFIG = [
  { side: "A" as const, color: "#10b981", label: "Dupla A — viram para a direita" },
  { side: "B" as const, color: "#06b6d4", label: "Dupla B — viram para a esquerda" },
];

export function MatchPlayerPicker({
  players,
  initial,
}: {
  players: PlayerOption[];
  initial?: InitialData;
}) {
  const playerById = useMemo(() => {
    const m = new Map<string, PlayerOption>();
    players.forEach((p) => m.set(p.id, p));
    return m;
  }, [players]);

  const photoOptions: PhotoOption[] = useMemo(
    () => players.map((p) => ({ id: p.id, name: p.name, short_name: p.short_name, photo_url: p.photo_url })),
    [players],
  );

  const [slots, setSlots] = useState<Record<Slot, SlotState>>(() => {
    if (!initial) {
      return { a1: empty(), a2: empty(), b1: empty(), b2: empty() };
    }
    const seed = (s: InitialSlot): SlotState => {
      const p = s.playerId ? playerById.get(s.playerId) : undefined;
      return {
        name: s.name,
        shortName: s.shortName,
        shortAuto: false, // já temos um curto guardado — não sobrescrever
        playerId: s.playerId,
        photoBlob: null, // carregada no efeito de mount abaixo
        mirror: p?.mirror ?? false,
      };
    };
    return {
      a1: seed(initial.a1),
      a2: seed(initial.a2),
      b1: seed(initial.b1),
      b2: seed(initial.b2),
    };
  });
  const [keepComposites, setKeepComposites] = useState(initial?.hasComposites ?? false);
  const [compose, setCompose] = useState<ComposeResult>({ teamA: null, teamB: null });
  const [composeUrls, setComposeUrls] = useState<{ a: string | null; b: string | null }>({
    a: null,
    b: null,
  });
  const [processing, setProcessing] = useState<Slot | "compose" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState<Slot | null>(null);

  const teamAFile = useRef<HTMLInputElement>(null);
  const teamBFile = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (compose.teamA && teamAFile.current) {
      const dt = new DataTransfer();
      dt.items.add(new File([compose.teamA], "team_a_composite.png", { type: "image/png" }));
      teamAFile.current.files = dt.files;
    } else if (teamAFile.current) {
      teamAFile.current.value = "";
    }
    if (compose.teamB && teamBFile.current) {
      const dt = new DataTransfer();
      dt.items.add(new File([compose.teamB], "team_b_composite.png", { type: "image/png" }));
      teamBFile.current.files = dt.files;
    } else if (teamBFile.current) {
      teamBFile.current.value = "";
    }
  }, [compose]);

  // Modo edição: carrega as fotos dos jogadores que já estavam no jogo.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!initial || seededRef.current) return;
    seededRef.current = true;
    (["a1", "a2", "b1", "b2"] as Slot[]).forEach(async (sid) => {
      const pid = initial[sid].playerId;
      if (!pid) return;
      const p = playerById.get(pid);
      if (!p?.photo_url) return;
      try {
        const res = await fetch(p.photo_url, { cache: "force-cache" });
        const blob = await res.blob();
        setSlots((s) => ({ ...s, [sid]: { ...s[sid], photoBlob: blob } }));
      } catch {
        /* ignora — fica sem thumbnail mas o composite antigo mantém-se */
      }
    });
  }, [initial, playerById]);

  function setSlot(slot: Slot, patch: Partial<SlotState>) {
    setSlots((s) => ({ ...s, [slot]: { ...s[slot], ...patch } }));
  }

  function invalidateComposites() {
    setCompose({ teamA: null, teamB: null });
    setComposeUrls({ a: null, b: null });
  }

  function onNameChange(slot: Slot, name: string) {
    setSlots((s) => {
      const current = s[slot];
      const nextShort = current.shortAuto ? deriveShortName(name) : current.shortName;
      return { ...s, [slot]: { ...current, name, shortName: nextShort } };
    });
  }

  function onShortNameChange(slot: Slot, shortName: string) {
    setSlot(slot, { shortName, shortAuto: false });
  }

  async function onPickPhoto(slot: Slot, picked: PhotoOption | null) {
    setError(null);
    invalidateComposites();

    if (!picked) {
      setSlot(slot, { playerId: null, photoBlob: null });
      return;
    }

    const p = playerById.get(picked.id);
    if (!p) return;

    setSlots((s) => {
      const cur = s[slot];
      // Auto-fill nomes se ainda estavam vazios.
      const nextName = cur.name.trim() === "" ? p.name : cur.name;
      const nextShort =
        cur.shortName.trim() === ""
          ? p.short_name ?? deriveShortName(p.name)
          : cur.shortName;
      return {
        ...s,
        [slot]: {
          ...cur,
          playerId: p.id,
          mirror: p.mirror,
          photoBlob: null,
          name: nextName,
          shortName: nextShort,
          // Se nome curto está auto e o nome longo bate certo com o do player, mantém auto.
          shortAuto: cur.shortAuto && nextName === p.name,
        },
      };
    });

    if (!p.photo_url) return;

    setProcessing(slot);
    try {
      const res = await fetch(p.photo_url, { cache: "force-cache" });
      const blob = await res.blob();
      setSlot(slot, { photoBlob: blob });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha a obter foto");
    } finally {
      setProcessing(null);
    }
  }

  function toggleMirror(slot: Slot) {
    setSlot(slot, { mirror: !slots[slot].mirror });
    invalidateComposites();
  }

  async function buildComposites() {
    setError(null);
    setProcessing("compose");
    try {
      // 1) Carrega as 4 fotos + detecta a cara de cada uma.
      const load = async (
        inp: { blob: Blob; mirror: boolean } | null,
      ): Promise<LoadedPlayer | null> => {
        if (!inp) return null;
        const img = await loadImage(inp.blob);
        const face = await detectFaceBox(img).catch(() => null);
        return { img, mirror: inp.mirror, face };
      };
      const [a1, a2, b1, b2] = await Promise.all([
        load(slotInput(slots.a1)),
        load(slotInput(slots.a2)),
        load(slotInput(slots.b1)),
        load(slotInput(slots.b2)),
      ]);

      // 2) Corte PARTILHADO pelos 4 jogadores das duas duplas. Calculamos,
      //    em unidades de "largura de cara", quanto cada foto mostra acima
      //    da cabeça e abaixo dos olhos — e usamos o MÍNIMO comum. Assim
      //    todos os jogadores (Dupla A e B) ficam cortados exactamente ao
      //    mesmo sítio → mesmo enquadramento, mesmo tamanho de corpo.
      const withFace = [a1, a2, b1, b2].filter(
        (p): p is LoadedPlayer => p != null && p.face != null,
      );
      let crop: { above: number; below: number } | null = null;
      if (withFace.length > 0) {
        const above = Math.min(
          ...withFace.map((p) => p.face!.eyeLineY / p.face!.eyeSpan),
        );
        const below = Math.min(
          ...withFace.map(
            (p) => (p.img.height - p.face!.eyeLineY) / p.face!.eyeSpan,
          ),
        );
        crop = {
          above: Math.min(above, 1.8), // teto de headroom
          below: Math.min(below, 4.6), // teto de corpo (cabeça → cintura)
        };
      }

      // 3) Compõe as duas duplas com o MESMO corte.
      const teamA = await composeTeam([a1, a2], "left-to-right", crop);
      const teamB = await composeTeam([b1, b2], "right-to-left", crop);
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

  const anyPhoto = (Object.values(slots) as SlotState[]).some((s) => s.photoBlob !== null);
  const hasComposite = compose.teamA !== null || compose.teamB !== null;

  return (
    <div className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200/80 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Jogadores
        </div>
        <p className="mt-1 text-xs text-slate-500">
          <strong className="text-slate-700">Nome (TV)</strong> aparece no
          scoreboard grande. <strong className="text-slate-700">OBS</strong> é a
          versão curta para a overlay. Foto é opcional — só precisas dela para
          o scoreboard TV.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {TEAM_CONFIG.map((t) => {
          const slotIds: Slot[] = t.side === "A" ? ["a1", "a2"] : ["b1", "b2"];
          return (
            <fieldset
              key={t.side}
              className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
            >
              <legend className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
                {t.label}
              </legend>
              {slotIds.map((sid) => (
                <SlotRow
                  key={sid}
                  id={sid}
                  state={slots[sid]}
                  processing={processing === sid}
                  catalogueAvailable={players.length > 0}
                  onNameChange={(n) => onNameChange(sid, n)}
                  onShortNameChange={(n) => onShortNameChange(sid, n)}
                  onOpenPicker={() => setPickerOpen(sid)}
                  onToggleMirror={() => toggleMirror(sid)}
                />
              ))}
            </fieldset>
          );
        })}
      </div>

      {(anyPhoto || keepComposites) && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={buildComposites}
              disabled={!anyPhoto || processing !== null}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {processing === "compose"
              ? "IA a alinhar duplas..."
              : "Compor duplas para TV"}
            </button>
            {processing && processing !== "compose" && (
              <span className="text-xs font-medium text-cyan-600">A carregar foto…</span>
            )}
            {hasComposite && (
              <span className="text-xs font-medium text-emerald-600">
                ✓ Composites novos prontos — submete o jogo.
              </span>
            )}
            {!hasComposite && keepComposites && (
              <span className="text-xs font-medium text-cyan-600">
                As fotos actuais do jogo mantêm-se. Só recompõe se quiseres
                trocá-las.
              </span>
            )}
            {!hasComposite && !keepComposites && (
              <span className="text-xs text-slate-500">
                Opcional. Sem isto, o jogo fica só com nomes.
              </span>
            )}
          </div>

          {(composeUrls.a || composeUrls.b) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {composeUrls.a && <PreviewCard label="Composite Dupla A" url={composeUrls.a} />}
              {composeUrls.b && <PreviewCard label="Composite Dupla B" url={composeUrls.b} />}
            </div>
          )}
        </div>
      )}

      {/* Hidden fields */}
      <input ref={teamAFile} type="file" name="team_a_photo" className="hidden" />
      <input ref={teamBFile} type="file" name="team_b_photo" className="hidden" />
      {(["a1", "a2", "b1", "b2"] as Slot[]).map((s) => (
        <span key={s}>
          <input
            type="hidden"
            name={`team_${s[0]}_player${s[1]}`}
            value={slots[s].name}
          />
          <input
            type="hidden"
            name={`team_${s[0]}_player${s[1]}_short`}
            value={slots[s].shortName}
          />
          <input
            type="hidden"
            name={`team_${s[0]}_player${s[1]}_id`}
            value={slots[s].playerId ?? ""}
          />
        </span>
      ))}

      {/* Modal */}
      <PhotoPickerModal
        open={pickerOpen !== null}
        onClose={() => setPickerOpen(null)}
        onPick={(p) => pickerOpen && onPickPhoto(pickerOpen, p)}
        players={photoOptions}
        currentId={pickerOpen ? slots[pickerOpen].playerId : null}
      />

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

function slotInput(s: SlotState): { blob: Blob; mirror: boolean } | null {
  if (!s.photoBlob) return null;
  return { blob: s.photoBlob, mirror: s.mirror };
}

function empty(): SlotState {
  return {
    name: "",
    shortName: "",
    shortAuto: true,
    playerId: null,
    photoBlob: null,
    mirror: false,
  };
}

// ---------------------------------------------------------------------------
function SlotRow({
  id,
  state,
  processing,
  catalogueAvailable,
  onNameChange,
  onShortNameChange,
  onOpenPicker,
  onToggleMirror,
}: {
  id: Slot;
  state: SlotState;
  processing: boolean;
  catalogueAvailable: boolean;
  onNameChange: (name: string) => void;
  onShortNameChange: (name: string) => void;
  onOpenPicker: () => void;
  onToggleMirror: () => void;
}) {
  const photoUrl = useObjectURL(state.photoBlob);
  const isPlayer1 = id[1] === "1";
  const inputId = `slot-${id}-name`;
  const shortId = `slot-${id}-short`;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {isPlayer1 ? "Jogador 1" : <>Jogador 2 <span className="text-slate-400">(opcional)</span></>}
      </div>
      <div className="flex items-stretch gap-2">
        {/* Thumbnail / botão para abrir picker */}
        <button
          type="button"
          onClick={onOpenPicker}
          disabled={!catalogueAvailable}
          title={catalogueAvailable ? "Escolher foto do catálogo" : "Sem jogadores no catálogo"}
          className={[
            "bg-checker group relative grid h-20 w-16 shrink-0 place-items-center overflow-hidden rounded-md border transition",
            catalogueAvailable
              ? "border-slate-300 hover:border-emerald-500"
              : "cursor-not-allowed border-slate-200 opacity-50",
          ].join(" ")}
        >
          {photoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={photoUrl}
              alt=""
              className="h-full w-full object-cover"
              style={{ transform: state.mirror ? "scaleX(-1)" : undefined }}
            />
          ) : processing ? (
            <span className="text-[9px] font-semibold text-emerald-600">…</span>
          ) : (
            <div className="flex flex-col items-center gap-0.5 text-[9px] font-medium uppercase tracking-wider text-slate-500">
              <span className="text-base leading-none">📷</span>
              <span>Foto</span>
            </div>
          )}
          {photoUrl && (
            <div className="absolute inset-x-0 bottom-0 bg-slate-900/80 py-0.5 text-center text-[9px] font-semibold uppercase tracking-wider text-white opacity-0 transition group-hover:opacity-100">
              Trocar
            </div>
          )}
        </button>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <input
            id={inputId}
            type="text"
            value={state.name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Nome (TV) — ex: Paulo Tavares"
            required={isPlayer1}
            autoComplete="off"
            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none transition hover:border-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
          />
          <div className="flex items-center gap-2">
            <input
              id={shortId}
              type="text"
              value={state.shortName}
              onChange={(e) => onShortNameChange(e.target.value)}
              placeholder="Curto (OBS) — ex: Paulo T"
              autoComplete="off"
              className="flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 outline-none transition hover:border-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
            />
            {state.photoBlob && (
              <button
                type="button"
                onClick={onToggleMirror}
                className={[
                  "shrink-0 rounded border px-2 py-1 text-[10px] font-medium uppercase tracking-wider transition",
                  state.mirror
                    ? "border-cyan-300 bg-cyan-50 text-cyan-700"
                    : "border-slate-300 bg-white text-slate-500 hover:border-slate-400",
                ].join(" ")}
                title="Espelhar foto"
              >
                🔄
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewCard({ label, url }: { label: string; url: string }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
        {label}
      </div>
      <div className="bg-checker overflow-hidden rounded-lg border border-slate-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="block w-full" />
      </div>
    </div>
  );
}

function useObjectURL(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

// ---------------------------------------------------------------------------
type LoadedPlayer = {
  img: HTMLImageElement;
  mirror: boolean;
  face: FaceBox | null;
};

// =============================================================================
// composeTeam — composição INTELIGENTE da dupla para a TV
// -----------------------------------------------------------------------------
// Recebe os jogadores JÁ carregados + um `crop` partilhado (calculado em
// buildComposites a partir das 4 fotos). Cada jogador é cortado exactamente
// à mesma extensão relativa à cara → todos mostram o mesmo "pedaço" de corpo,
// com a cara do mesmo tamanho e os olhos na mesma linha. Resultado: Dupla A
// e Dupla B perfeitamente consistentes.
//
// + glow radial suave por trás   + sombra elíptica de contacto
// Fallback (sem cara detectada): escala a imagem inteira para a altura comum.
// =============================================================================
async function composeTeam(
  players: (LoadedPlayer | null)[],
  direction: "left-to-right" | "right-to-left",
  crop: { above: number; below: number } | null,
): Promise<Blob | null> {
  const present = players.filter((p): p is LoadedPlayer => p !== null);
  if (present.length === 0) return null;

  const drawOrder =
    direction === "right-to-left" ? [...present].reverse() : present;

  // Largura desejada da cara no canvas (define a escala absoluta).
  const TARGET_FACE_W = drawOrder.length === 2 ? 230 : 290;
  // Altura comum a TODOS os jogadores (mesmo enquadramento garantido).
  const cropU = crop ?? { above: 1.5, below: 4.2 };
  const rowH = (cropU.above + cropU.below) * TARGET_FACE_W;

  type Item = {
    img: HTMLImageElement;
    mirror: boolean;
    sx: number;
    sy: number;
    sw: number;
    sh: number; // rectângulo de corte na imagem original
    dw: number;
    dh: number; // tamanho de destino (dh = rowH para todos)
  };

  const items: Item[] = drawOrder.map((p) => {
    if (p.face && crop) {
      const { eyeLineY, eyeSpan } = p.face;
      const scale = TARGET_FACE_W / eyeSpan;
      const sy = eyeLineY - crop.above * eyeSpan;
      const sh = (crop.above + crop.below) * eyeSpan;
      return {
        img: p.img,
        mirror: p.mirror,
        sx: 0,
        sy,
        sw: p.img.width,
        sh,
        dw: p.img.width * scale,
        dh: rowH, // = sh * scale — igual para todos
      };
    }
    // Fallback sem cara: imagem inteira escalada à altura comum.
    const scale = rowH / p.img.height;
    return {
      img: p.img,
      mirror: p.mirror,
      sx: 0,
      sy: 0,
      sw: p.img.width,
      sh: p.img.height,
      dw: p.img.width * scale,
      dh: rowH,
    };
  });

  // Layout horizontal — sobreposição 30%.
  const overlap = 0.3;
  const groupW = items.reduce(
    (acc, it, i) => acc + (i === 0 ? it.dw : it.dw * (1 - overlap)),
    0,
  );

  // Canvas adaptado ao conteúdo (+ margem p/ glow e sombra). Como rowH é
  // igual em todas as composições, Dupla A e B saem do mesmo tamanho.
  const padX = TARGET_FACE_W * 0.55;
  const padTop = TARGET_FACE_W * 0.3;
  const padBottom = TARGET_FACE_W * 0.6;
  const CW = Math.round(groupW + padX * 2);
  const CH = Math.round(rowH + padTop + padBottom);

  const canvas = document.createElement("canvas");
  canvas.width = CW;
  canvas.height = CH;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, CW, CH);

  // Glow radial suave por trás.
  const glowCX = CW / 2;
  const glowCY = padTop + rowH * 0.42;
  const glow = ctx.createRadialGradient(
    glowCX,
    glowCY,
    0,
    glowCX,
    glowCY,
    CW * 0.55,
  );
  glow.addColorStop(0, "rgba(255,255,255,0.18)");
  glow.addColorStop(0.6, "rgba(255,255,255,0.05)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CW, CH);

  // Posições — grupo centrado horizontalmente, topo em padTop.
  let x = (CW - groupW) / 2;
  const placed = items.map((it) => {
    const dx = x;
    const dy = padTop;
    x += it.dw * (1 - overlap);
    return { ...it, dx, dy };
  });

  // Sombra elíptica de contacto sob cada jogador.
  for (const p of placed) {
    const cx = p.dx + p.dw / 2;
    const feetY = p.dy + p.dh;
    const rx = p.dw * 0.4;
    const ry = rx * 0.15;
    ctx.save();
    ctx.translate(cx, feetY);
    ctx.scale(1, ry / rx);
    const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    sh.addColorStop(0, "rgba(0,0,0,0.5)");
    sh.addColorStop(0.7, "rgba(0,0,0,0.18)");
    sh.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Jogadores — corte da fonte (sx,sy,sw,sh) + mirror per-image.
  for (const p of placed) {
    if (p.mirror) {
      ctx.save();
      ctx.translate(p.dx + p.dw, p.dy);
      ctx.scale(-1, 1);
      ctx.drawImage(p.img, p.sx, p.sy, p.sw, p.sh, 0, 0, p.dw, p.dh);
      ctx.restore();
    } else {
      ctx.drawImage(p.img, p.sx, p.sy, p.sw, p.sh, p.dx, p.dy, p.dw, p.dh);
    }
  }

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
