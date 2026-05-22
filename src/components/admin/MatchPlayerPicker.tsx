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
      const teamA = await composeTeam(
        [slotInput(slots.a1), slotInput(slots.a2)],
        "left-to-right",
      );
      const teamB = await composeTeam(
        [slotInput(slots.b1), slotInput(slots.b2)],
        "right-to-left",
      );
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
// =============================================================================
// composeTeam — composição INTELIGENTE da dupla para a TV
// -----------------------------------------------------------------------------
// 1. Detecta o rosto de cada jogador (MediaPipe FaceLandmarker)
// 2. Escala cada jogador para as CABEÇAS ficarem do mesmo tamanho
// 3. Alinha as LINHAS DOS OLHOS na mesma altura
// 4. Desenha um glow radial suave por trás (destaca sem fundo opaco)
// 5. Desenha uma sombra elíptica de contacto em baixo de cada jogador
// Fallback: se não detectar cara, escala por altura (comportamento antigo).
// =============================================================================
async function composeTeam(
  inputs: ({ blob: Blob; mirror: boolean } | null)[],
  direction: "left-to-right" | "right-to-left",
): Promise<Blob | null> {
  const loaded = await Promise.all(
    inputs.map(async (i) => {
      if (!i) return null;
      const img = await loadImage(i.blob);
      const face = await detectFaceBox(img).catch(() => null);
      return { img, mirror: i.mirror, face };
    }),
  );
  const players = loaded.filter(
    (p): p is { img: HTMLImageElement; mirror: boolean; face: FaceBox | null } =>
      p !== null,
  );
  if (players.length === 0) return null;

  const CW = 1500;
  const CH = 1000;
  const drawOrder = direction === "right-to-left" ? [...players].reverse() : players;

  // --- 1) Escala inicial: por largura de cara (cabeças iguais) ---
  // TARGET_FACE_W = largura desejada da cara no canvas. 2 jogadores → menor.
  const TARGET_FACE_W = drawOrder.length === 2 ? 150 : 200;

  type Item = {
    img: HTMLImageElement;
    mirror: boolean;
    w: number;
    h: number;
    eyeY: number; // Y da linha dos olhos relativo ao topo da imagem escalada
  };

  let items: Item[] = drawOrder.map((p) => {
    if (p.face) {
      const sc = TARGET_FACE_W / p.face.eyeSpan;
      return {
        img: p.img,
        mirror: p.mirror,
        w: p.img.width * sc,
        h: p.img.height * sc,
        eyeY: p.face.eyeLineY * sc,
      };
    }
    // Fallback sem cara: escala por altura, olhos estimados a 22% do topo.
    const sc = (CH * 0.9) / p.img.height;
    return {
      img: p.img,
      mirror: p.mirror,
      w: p.img.width * sc,
      h: p.img.height * sc,
      eyeY: p.img.height * sc * 0.22,
    };
  });

  // --- 2) Layout horizontal: sobreposição 30% ---
  const overlap = 0.3;
  const rawGroupW = items.reduce(
    (acc, it, i) => acc + (i === 0 ? it.w : it.w * (1 - overlap)),
    0,
  );

  // --- 3) Extensão vertical (olhos alinhados em y=0 como referência) ---
  const rawTop = Math.min(...items.map((it) => -it.eyeY));
  const rawBot = Math.max(...items.map((it) => -it.eyeY + it.h));
  const rawGroupH = rawBot - rawTop;

  // --- 4) Fit global — garante que o grupo cabe em 92% do canvas ---
  const fit = Math.min(1, (CW * 0.92) / rawGroupW, (CH * 0.92) / rawGroupH);
  items = items.map((it) => ({
    ...it,
    w: it.w * fit,
    h: it.h * fit,
    eyeY: it.eyeY * fit,
  }));
  const groupW = rawGroupW * fit;
  const groupH = rawGroupH * fit;
  const gTop = rawTop * fit;

  // --- 5) Posições finais ---
  const groupTopOnCanvas = (CH - groupH) / 2;
  const eyeLineCanvasY = groupTopOnCanvas - gTop;
  let x = (CW - groupW) / 2;
  const placed = items.map((it) => {
    const drawX = x;
    const drawY = eyeLineCanvasY - it.eyeY;
    x += it.w * (1 - overlap);
    return { ...it, drawX, drawY };
  });

  // --- 6) Desenho ---
  const canvas = document.createElement("canvas");
  canvas.width = CW;
  canvas.height = CH;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, CW, CH);

  // 6a) Glow radial suave por trás (centro do grupo). Branco translúcido —
  //     "levanta" os jogadores de qualquer fundo sem ser opaco.
  const glowCX = CW / 2;
  const glowCY = groupTopOnCanvas + groupH * 0.45;
  const glow = ctx.createRadialGradient(
    glowCX,
    glowCY,
    0,
    glowCX,
    glowCY,
    CW * 0.5,
  );
  glow.addColorStop(0, "rgba(255,255,255,0.20)");
  glow.addColorStop(0.55, "rgba(255,255,255,0.06)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CW, CH);

  // 6b) Sombra elíptica de contacto sob cada jogador (antes de os desenhar).
  for (const p of placed) {
    const cx = p.drawX + p.w / 2;
    const feetY = p.drawY + p.h;
    const rx = p.w * 0.4;
    const ry = rx * 0.16;
    ctx.save();
    ctx.translate(cx, feetY);
    ctx.scale(1, ry / rx);
    const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    sh.addColorStop(0, "rgba(0,0,0,0.5)");
    sh.addColorStop(0.7, "rgba(0,0,0,0.2)");
    sh.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 6c) Jogadores (com mirror per-image).
  for (const p of placed) {
    if (p.mirror) {
      ctx.save();
      ctx.translate(p.drawX + p.w, p.drawY);
      ctx.scale(-1, 1);
      ctx.drawImage(p.img, 0, 0, p.w, p.h);
      ctx.restore();
    } else {
      ctx.drawImage(p.img, p.drawX, p.drawY, p.w, p.h);
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
