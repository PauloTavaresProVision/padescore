"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button, LinkButton } from "@/components/ui/Button";
import { Fieldset } from "@/components/ui/Card";
import { SinglePlayerPhotoUpload } from "@/components/admin/SinglePlayerPhotoUpload";
import { createPlayer } from "../actions";
import { deriveShortName } from "@/lib/names";
import type { Facing } from "@/lib/face-direction";

export function NewPlayerForm() {
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [shortTouched, setShortTouched] = useState(false);

  // Modo de orientação: IA decide automaticamente vs operador decide.
  const [aiMode, setAiMode] = useState(true);
  const [mirror, setMirror] = useState(false);
  const [aiFacing, setAiFacing] = useState<Facing | null>(null);

  function onNameChange(v: string) {
    setName(v);
    if (!shortTouched) setShortName(deriveShortName(v));
  }

  // Convenção: catálogo normalizado para o jogador ficar VIRADO PARA A
  // DIREITA. Se a IA detecta "esquerda" → espelhar; "direita" → não;
  // "unknown" → não força (mantém o que está).
  function onFacing(f: Facing) {
    setAiFacing(f);
    if (!aiMode) return;
    if (f === "left") setMirror(true);
    else if (f === "right") setMirror(false);
  }

  return (
    <form action={createPlayer} className="mt-8 space-y-6">
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
              placeholder="Ex: Paulo Tavares"
              autoComplete="off"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-500">
              Como aparece no scoreboard TV (espaço grande).
            </p>
          </div>
          <div>
            <label htmlFor="short_name" className="mb-1.5 block text-sm font-medium text-slate-200">
              Nome curto (OBS)
            </label>
            <Input
              id="short_name"
              name="short_name"
              placeholder="Ex: Paulo T"
              autoComplete="off"
              value={shortName}
              onChange={(e) => {
                setShortTouched(true);
                setShortName(e.target.value);
              }}
            />
            <p className="mt-1 text-xs text-slate-500">
              Versão abreviada para a overlay OBS. Auto-preenchida — editável.
            </p>
          </div>
        </div>
      </Fieldset>

      <Fieldset legend="Foto (a IA remove o fundo no upload)">
        {/* Modo de orientação: IA automática vs manual */}
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
                aiMode
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-slate-500 hover:text-slate-800",
              ].join(" ")}
            >
              🤖 IA automática
            </button>
            <button
              type="button"
              onClick={() => setAiMode(false)}
              className={[
                "px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition",
                !aiMode
                  ? "bg-slate-700 text-white"
                  : "bg-white text-slate-500 hover:text-slate-800",
              ].join(" ")}
            >
              ✋ Manual
            </button>
          </div>
          <span className="text-[11px] text-slate-500">
            {aiMode
              ? "A IA detecta a direcção e espelha sozinha. Podes corrigir abaixo."
              : "Tu decides com o botão Espelhar."}
          </span>
        </div>

        <SinglePlayerPhotoUpload onFacing={onFacing} detectEnabled />

        {aiMode && aiFacing && (
          <div className="mt-3 text-[11px] text-slate-500">
            Resultado IA:{" "}
            <strong className="text-slate-800">
              {aiFacing === "left"
                ? "virado para a esquerda → espelhei"
                : aiFacing === "right"
                  ? "virado para a direita → mantive"
                  : "indefinido → não mexi (confirma manualmente)"}
            </strong>
            . Se estiver errado, carrega em Espelhar.
          </div>
        )}

        {/* checkbox de mirror controlado (hidden input garante o submit "on") */}
        {mirror && <input type="hidden" name="mirror" value="on" />}
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-slate-300">
          <input
            type="checkbox"
            checked={mirror}
            onChange={(e) => setMirror(e.target.checked)}
            className="peer sr-only"
          />
          <span className="relative mt-0.5 inline-block h-5 w-9 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-emerald-500" >
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
                ? "A IA já decidiu — só mexe aqui se a IA se enganou."
                : "Marca se o jogador foi fotografado a olhar para o lado errado."}
            </span>
          </span>
        </label>
      </Fieldset>

      <div className="flex justify-end gap-3 pt-2">
        <LinkButton href="/admin/players" variant="secondary">
          Cancelar
        </LinkButton>
        <Button type="submit">Adicionar jogador</Button>
      </div>
    </form>
  );
}
