import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Input } from "@/components/ui/Input";
import { Button, LinkButton } from "@/components/ui/Button";
import { Fieldset } from "@/components/ui/Card";
import { ChevronLeftIcon, TrashIcon } from "@/components/icons";
import { updateTournament, deleteTournament } from "./actions";
import { DeleteTournamentButton } from "./DeleteTournamentButton";

export default async function EditTournamentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", id)
    .single();

  if (!tournament) notFound();
  if (tournament.owner_id !== user.id) redirect("/admin");

  const updateBound = updateTournament.bind(null, id);
  const deleteBound = deleteTournament.bind(null, id);

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/admin/tournaments/${id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-900"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        {tournament.name}
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Editar torneio</h1>

      {sp.error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {sp.error}
        </div>
      )}

      <form action={updateBound} className="mt-8 space-y-6">
        <Fieldset legend="Identificação">
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-slate-700">
              Nome
            </label>
            <Input id="name" name="name" required defaultValue={tournament.name} />
          </div>
        </Fieldset>

        <Fieldset legend="Marca" hint="Logo e cor aparecem no overlay para transmissão.">
          {/* Preview do logo actual */}
          <div className="flex items-center gap-4">
            <div
              className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border-2 bg-slate-50"
              style={{ borderColor: (tournament.primary_color ?? "#10b981") + "50" }}
            >
              {tournament.logo_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={tournament.logo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl font-black text-slate-500">
                  {tournament.name.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 text-xs text-slate-500">
              {tournament.logo_url ? (
                <>
                  <p>Logo actual ao lado.</p>
                  <p className="mt-1">Carrega um novo ficheiro para substituir, ou marca a opção em baixo para remover.</p>
                </>
              ) : (
                <p>Sem logo definido. Carrega um ficheiro abaixo.</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div>
              <label htmlFor="logo" className="mb-1.5 block text-sm font-medium text-slate-700">
                Novo logo (opcional)
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
                defaultValue={tournament.primary_color ?? "#10b981"}
                className="h-[46px] w-20 cursor-pointer rounded-lg border border-slate-300 bg-white"
              />
            </div>
          </div>

          {tournament.logo_url && (
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 transition hover:border-slate-300">
              <input
                type="checkbox"
                name="remove_logo"
                className="h-4 w-4 rounded border-slate-300 bg-white text-emerald-600 focus:ring-emerald-500"
              />
              <TrashIcon className="h-4 w-4 text-slate-500" />
              Remover logo (deixa só a inicial do nome)
            </label>
          )}

          {/* TV Background */}
          <div className="border-t border-slate-200 pt-5">
            <div className="flex items-start gap-4">
              <div
                className="grid h-24 w-40 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-300 bg-slate-50"
              >
                {tournament.tv_background_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={tournament.tv_background_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="px-2 text-center text-[10px] text-slate-500">
                    sem fundo TV
                  </span>
                )}
              </div>
              <div className="flex-1 text-xs text-slate-500">
                {tournament.tv_background_url ? (
                  <>
                    <p>Fundo TV actual à esquerda.</p>
                    <p className="mt-1">Carrega novo ficheiro para substituir.</p>
                  </>
                ) : (
                  <p>Sem fundo TV definido. Carrega uma imagem (ideal 1920×1080).</p>
                )}
              </div>
            </div>

            <div className="mt-3">
              <label htmlFor="tv_background" className="mb-1.5 block text-sm font-medium text-slate-700">
                Novo fundo TV (opcional)
              </label>
              <input
                id="tv_background"
                name="tv_background"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-white text-sm text-slate-500 outline-none transition hover:border-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 file:mr-4 file:cursor-pointer file:border-0 file:bg-slate-100 file:px-4 file:py-3 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                Imagem full-screen do scoreboard TV. Os dados dinâmicos (score, sets, tempo, fotos) são sobrepostos nas posições.
              </p>
            </div>

            {tournament.tv_background_url && (
              <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 transition hover:border-slate-300">
                <input
                  type="checkbox"
                  name="remove_tv_background"
                  className="h-4 w-4 rounded border-slate-300 bg-white text-emerald-600 focus:ring-emerald-500"
                />
                <TrashIcon className="h-4 w-4 text-slate-500" />
                Remover fundo TV
              </label>
            )}
          </div>

          {/* Imagem do ecrã de espera */}
          <div className="border-t border-slate-200 pt-5">
            <div className="flex items-start gap-4">
              <div className="grid h-24 w-40 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-300 bg-slate-50">
                {tournament.tv_standby_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={tournament.tv_standby_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="px-2 text-center text-[10px] text-slate-500">
                    sem ecrã de espera
                  </span>
                )}
              </div>
              <div className="flex-1 text-xs text-slate-500">
                <p>
                  Imagem mostrada na TV <strong>entre jogos</strong> (&ldquo;AGUARDE
                  O PRÓXIMO JOGO&rdquo;).
                </p>
                <p className="mt-1">
                  Imagem <strong>já com o texto/branding</strong> (a TV mostra-a
                  tal e qual, só com brilho/animação ambiente por cima). Se não
                  definires, usa um ecrã genérico.
                </p>
              </div>
            </div>

            <div className="mt-3">
              <label htmlFor="tv_standby" className="mb-1.5 block text-sm font-medium text-slate-700">
                Imagem do ecrã de espera (opcional)
              </label>
              <input
                id="tv_standby"
                name="tv_standby"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-white text-sm text-slate-500 outline-none transition hover:border-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 file:mr-4 file:cursor-pointer file:border-0 file:bg-slate-100 file:px-4 file:py-3 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                Full-screen, ideal 1920×1080. Igual à imagem que desenhaste com
                &ldquo;AGUARDE O PRÓXIMO JOGO&rdquo;.
              </p>
            </div>

            {tournament.tv_standby_url && (
              <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 transition hover:border-slate-300">
                <input
                  type="checkbox"
                  name="remove_tv_standby"
                  className="h-4 w-4 rounded border-slate-300 bg-white text-emerald-600 focus:ring-emerald-500"
                />
                <TrashIcon className="h-4 w-4 text-slate-500" />
                Remover ecrã de espera
              </label>
            )}
          </div>
        </Fieldset>

        <Fieldset
          legend="Scoreboard TV"
          hint="Layout do ecrã de transmissão (/tv/live/...)."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50/50"
            >
              <input
                type="radio"
                name="tv_layout"
                value="classic"
                defaultChecked={(tournament.tv_layout ?? "classic") === "classic"}
                className="mt-1 h-4 w-4 border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-900">
                  Clássico
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Ecrã completo com fundo do torneio, fotos dos jogadores,
                  sets e relógio de jogo. O layout actual.
                </span>
              </span>
            </label>
            <label
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50/50"
            >
              <input
                type="radio"
                name="tv_layout"
                value="strip"
                defaultChecked={tournament.tv_layout === "strip"}
                className="mt-1 h-4 w-4 border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-900">
                  Strip broadcast
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Barra compacta no canto superior (estilo World Padel Tour):
                  S1 · S2 · JG · PT, bola de serviço e nomes curtos.
                </span>
              </span>
            </label>
          </div>
          <p className="text-xs text-slate-500">
            Podes pré-visualizar qualquer jogo com{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px]">
              /tv/CODIGO?layout=strip
            </code>{" "}
            sem mudar este setting.
          </p>
        </Fieldset>

        <Fieldset
          legend="Cavalete — rotação entre cenas"
          hint="Quanto tempo cada cena fica visível no display 1080×1920 do cavalete."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="scene_main_duration_sec"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Cena 1 — Jogos (em jogo agora + próximos + resultados)
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="scene_main_duration_sec"
                  name="scene_main_duration_sec"
                  type="number"
                  min={5}
                  max={600}
                  defaultValue={tournament.scene_main_duration_sec ?? 40}
                  className="w-28"
                />
                <span className="text-sm text-slate-500">segundos</span>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                Default: 40s. Min 5s, max 600s (10 min).
              </p>
            </div>
            <div>
              <label
                htmlFor="scene_sponsors_duration_sec"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Cena 3 — Publicidade (patrocinadores + parceiros)
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="scene_sponsors_duration_sec"
                  name="scene_sponsors_duration_sec"
                  type="number"
                  min={5}
                  max={300}
                  defaultValue={tournament.scene_sponsors_duration_sec ?? 15}
                  className="w-28"
                />
                <span className="text-sm text-slate-500">segundos</span>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                Default: 15s. Min 5s, max 300s (5 min).
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <b>Ciclo total:</b>{" "}
            {(tournament.scene_main_duration_sec ?? 40) +
              (tournament.scene_sponsors_duration_sec ?? 15)}
            s
            {" "}·{" "}
            <b>Publicidade representa:</b>{" "}
            {Math.round(
              ((tournament.scene_sponsors_duration_sec ?? 15) /
                ((tournament.scene_main_duration_sec ?? 40) +
                  (tournament.scene_sponsors_duration_sec ?? 15))) *
                100,
            )}
            % do tempo total
          </div>
        </Fieldset>

        <div className="flex items-center justify-between gap-3 pt-2">
          <DeleteTournamentButton action={deleteBound} tournamentName={tournament.name} />
          <div className="flex gap-3">
            <LinkButton href={`/admin/tournaments/${id}`} variant="secondary">
              Cancelar
            </LinkButton>
            <Button type="submit">Guardar alterações</Button>
          </div>
        </div>
      </form>
    </div>
  );
}
