"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button, LinkButton } from "@/components/ui/Button";
import { Fieldset } from "@/components/ui/Card";
import { SinglePlayerPhotoUpload } from "@/components/admin/SinglePlayerPhotoUpload";
import { updatePlayer } from "../../actions";
import { deriveShortName } from "@/lib/names";
import type { Facing } from "@/lib/face-direction";

interface Player {
  id: string;
  name: string;
  short_name: string | null;
  photo_url: string | null;
  mirror: boolean;
}

export function EditPlayerForm({ player }: { player: Player }) {
  const [name, setName] = useState(player.name);
  const [shortName, setShortName] = useState(player.short_name ?? "");
  // Se o nome curto já existe e bate certo com a derivação, mantém auto.
  const [shortAuto, setShortAuto] = useState(
    player.short_name === null ||
      player.short_name === "" ||
      player.short_name === deriveShortName(player.name),
  );
  const [mirror, setMirror] = useState(player.mirror);
  const [aiMode, setAiMode] = useState(true);
  const [aiFacing, setAiFacing] = useState<Facing | null>(null);

  function onNameChange(v: string) {
    setName(v);
    if (shortAuto) setShortName(deriveShortName(v));
  }

  function onFacing(f: Facing) {
    setAiFacing(f);
    if (!aiMode) return;
    if (f === "left") setMirror(true);
    else if (f === "right") setMirror(false);
  }

  // O server action `updatePlayer` é (id, formData). Curry via bind.
  const action = updatePlayer.bind(null, player.id);

  return (
    <form action={action} className="mt-8 space-y-6">
      <Fieldset legend="Identificação">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-slate-200">
              Nome completo (TV)
            </label>
            <Input
              id="name"
              name="name"
              required
              autoComplete="off"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-500">Como aparece no scoreboard TV.</p>
          </div>
          <div>
            <label htmlFor="short_name" className="mb-1.5 block text-sm font-medium text-slate-200">
              Nome curto (OBS)
            </label>
            <Input
              id="short_name"
              name="short_name"
              autoComplete="off"
              value={shortName}
              onChange={(e) => {
                setShortAuto(false);
                setShortName(e.target.value);
              }}
            />
            <p className="mt-1 text-xs text-slate-500">
              Versão para a overlay OBS. Auto-preenchida quando mexes no nome completo.
            </p>
          </div>
        </div>
      </Fieldset>

      <Fieldset legend="Foto">
        {player.photo_url && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="bg-checker grid h-20 w-16 shrink-0 place-items-center overflow-hidden rounded-md ring-1 ring-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={player.photo_url}
                alt=""
                className="h-full w-full object-cover"
                style={{ transform: mirror ? "scaleX(-1)" : undefined }}
              />
            </div>
            <div className="text-xs text-slate-500">
              <div className="font-semibold text-emerald-600">Foto actual</div>
              <div className="mt-0.5">
                Carrega uma foto nova abaixo para substituir, ou deixa em branco.
              </div>
            </div>
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Direcção:
          </span>
          <div className="flex overflow-hidden rounded-lg border border-slate-300">
            <button
              type="button"
              onClick={() => setAiMode(true)}
              className={[
                "px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition",
                aiMode ? "bg-emerald-600 text-white" : "bg-white text-slate-500 hover:text-slate-800",
              ].join(" ")}
            >
              🤖 IA automática
            </button>
            <button
              type="button"
              onClick={() => setAiMode(false)}
              className={[
                "px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition",
                !aiMode ? "bg-slate-700 text-white" : "bg-white text-slate-500 hover:text-slate-800",
              ].join(" ")}
            >
              ✋ Manual
            </button>
          </div>
          <span className="text-[11px] text-slate-500">
            Só corre na detecção se carregares foto nova.
          </span>
        </div>

        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {player.photo_url ? "Substituir por nova foto (opcional)" : "Adicionar foto"}
        </div>
        <div className="mt-2">
          <SinglePlayerPhotoUpload onFacing={onFacing} detectEnabled />
        </div>

        {aiMode && aiFacing && (
          <div className="mt-3 text-[11px] text-slate-500">
            Resultado IA:{" "}
            <strong className="text-slate-800">
              {aiFacing === "left"
                ? "virado para a esquerda → espelhei"
                : aiFacing === "right"
                  ? "virado para a direita → mantive"
                  : "indefinido → não mexi"}
            </strong>
          </div>
        )}

        {mirror && <input type="hidden" name="mirror" value="on" />}
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-slate-300">
          <input
            type="checkbox"
            checked={mirror}
            onChange={(e) => setMirror(e.target.checked)}
            className="peer sr-only"
          />
          <span className="relative mt-0.5 inline-block h-5 w-9 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-emerald-500">
            <span
              className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition"
              style={{ transform: mirror ? "translateX(16px)" : "none" }}
            />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-semibold text-slate-900">
              Espelhar foto {mirror && <span className="text-emerald-600">(activo)</span>}
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">
              {aiMode
                ? "A IA decidiu — só mexe se ela se enganou."
                : "Inverte horizontalmente quando esta foto for usada num jogo."}
            </span>
          </span>
        </label>
      </Fieldset>

      <div className="flex justify-end gap-3 pt-2">
        <LinkButton href="/admin/players" variant="secondary">
          Cancelar
        </LinkButton>
        <Button type="submit">Guardar alterações</Button>
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
    </form>
  );
}
