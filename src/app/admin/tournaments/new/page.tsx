import Link from "next/link";
import { createTournament } from "./actions";
import { Input } from "@/components/ui/Input";
import { Button, LinkButton } from "@/components/ui/Button";
import { Fieldset } from "@/components/ui/Card";
import { ChevronLeftIcon } from "@/components/icons";

export default async function NewTournamentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/admin/tournaments"
        className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-900"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Torneios
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">Novo torneio</h1>
      <p className="mt-1 text-sm text-slate-500">
        Um torneio agrupa jogos partilhando logo, cores e branding.
      </p>

      {sp.error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {sp.error}
        </div>
      )}

      <form action={createTournament} className="mt-8 space-y-6">
        <Fieldset legend="Identificação">
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-slate-700">
              Nome
            </label>
            <Input
              id="name"
              name="name"
              required
              placeholder="Ex.: Torneio Primavera 2026"
            />
          </div>
        </Fieldset>

        <Fieldset legend="Marca" hint="Logo e cor aparecem no overlay para transmissão.">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div>
              <label htmlFor="logo" className="mb-1.5 block text-sm font-medium text-slate-700">
                Logo (opcional)
              </label>
              <input
                id="logo"
                name="logo"
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-white text-sm text-slate-500 outline-none transition hover:border-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 file:mr-4 file:cursor-pointer file:border-0 file:bg-slate-100 file:px-4 file:py-3 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
              <p className="mt-1.5 text-xs text-slate-500">PNG, SVG, JPG · ~256×256 fica óptimo</p>
            </div>

            <div>
              <label htmlFor="primary_color" className="mb-1.5 block text-sm font-medium text-slate-700">
                Cor
              </label>
              <input
                id="primary_color"
                name="primary_color"
                type="color"
                defaultValue="#10b981"
                className="h-[46px] w-20 cursor-pointer rounded-lg border border-slate-300 bg-white"
              />
            </div>
          </div>

          <div className="pt-2">
            <label htmlFor="tv_background" className="mb-1.5 block text-sm font-medium text-slate-700">
              Background do scoreboard TV (opcional)
            </label>
            <input
              id="tv_background"
              name="tv_background"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-white text-sm text-slate-500 outline-none transition hover:border-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 file:mr-4 file:cursor-pointer file:border-0 file:bg-slate-100 file:px-4 file:py-3 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Imagem de fundo full-screen para o scoreboard TV (ideal 1920×1080). Os dados dinâmicos são sobrepostos.
            </p>
          </div>
        </Fieldset>

        <div className="flex justify-end gap-3 pt-2">
          <LinkButton href="/admin" variant="secondary">
            Cancelar
          </LinkButton>
          <Button type="submit">Criar torneio</Button>
        </div>
      </form>
    </div>
  );
}
