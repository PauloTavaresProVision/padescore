import Link from "next/link";
import { createMatch } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { Input } from "@/components/ui/Input";
import { Button, LinkButton } from "@/components/ui/Button";
import { Fieldset } from "@/components/ui/Card";
import { ChevronLeftIcon } from "@/components/icons";
import { MatchPlayerPicker, type PlayerOption } from "@/components/admin/MatchPlayerPicker";

const CATEGORIES = [
  { value: "M1", label: "M1 (Masculino)" },
  { value: "M2", label: "M2 (Masculino)" },
  { value: "M3", label: "M3 (Masculino)" },
  { value: "M4", label: "M4 (Masculino)" },
  { value: "F1", label: "F1 (Feminino)" },
  { value: "F2", label: "F2 (Feminino)" },
  { value: "F3", label: "F3 (Feminino)" },
  { value: "F4", label: "F4 (Feminino)" },
];

export default async function NewMatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const supabase = await createClient();
  const { data: playersRaw } = await supabase
    .from("players")
    .select("id, name, short_name, photo_url, mirror")
    .order("name", { ascending: true });
  const players: PlayerOption[] = playersRaw ?? [];

  const createMatchBound = createMatch.bind(null, id);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/admin/tournaments/${id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-400 transition hover:text-slate-200"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Voltar
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Novo jogo</h1>
      <p className="mt-1 text-sm text-slate-400">
        Escolhe court, categoria, jogadores e regras. As fotos vêm do{" "}
        <Link href="/admin/players" className="text-emerald-400 hover:underline">
          catálogo de jogadores
        </Link>
        .
      </p>

      {sp.error && (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {sp.error}
        </div>
      )}

      {players.length === 0 && (
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Ainda não tens jogadores no catálogo. Podes criar o jogo com nomes em
          texto (sem foto), ou{" "}
          <Link href="/admin/players/new" className="font-semibold underline">
            adicionar jogadores primeiro
          </Link>
          .
        </div>
      )}

      <form action={createMatchBound} className="mt-8 space-y-6">
        <Fieldset legend="Informação geral">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="court_name" className="mb-1.5 block text-sm font-medium text-slate-200">
                Court
              </label>
              <Input id="court_name" name="court_name" defaultValue="Court 1" />
            </div>
            <div>
              <label htmlFor="category" className="mb-1.5 block text-sm font-medium text-slate-200">
                Categoria
              </label>
              <select
                id="category"
                name="category"
                defaultValue=""
                className="w-full rounded-lg border border-slate-700/80 bg-slate-900 px-3.5 py-2.5 text-sm text-white outline-none transition hover:border-slate-600 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
              >
                <option value="">— Sem categoria —</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Fieldset>

        <MatchPlayerPicker players={players} />

        <Fieldset legend="Regras" hint="Podes mudar isto a meio só se reiniciares o jogo.">
          <Toggle
            name="golden_point"
            defaultChecked
            label="Golden point (morte súbita)"
            description="Em 40-40, o próximo ponto ganha o game. Desliga para jogar com vantagens (AD)."
          />

          <Toggle
            name="final_set_super_tiebreak"
            label="Set decisivo com super tiebreak (a 10)"
            description="No último set, substitui por um tiebreak a 10 pontos."
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField name="sets_to_win" label="Sets para ganhar" defaultValue={2} min={1} max={3} />
            <NumberField name="games_per_set" label="Games por set" defaultValue={6} min={4} max={9} />
            <NumberField name="tiebreak_at" label="Tiebreak em" defaultValue={6} min={4} max={9} />
            <NumberField name="tiebreak_points" label="Pontos do tiebreak" defaultValue={7} min={5} max={15} />
          </div>
        </Fieldset>

        <div className="flex justify-end gap-3 pt-2">
          <LinkButton href={`/admin/tournaments/${id}`} variant="secondary">
            Cancelar
          </LinkButton>
          <Button type="submit">Criar jogo</Button>
        </div>
      </form>
    </div>
  );
}

function Toggle({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 transition hover:border-slate-700 hover:bg-slate-900/60">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span
        className="relative mt-0.5 inline-block h-5 w-9 shrink-0 rounded-full bg-slate-700 transition before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white before:shadow-sm before:transition peer-checked:bg-emerald-500 peer-checked:before:translate-x-4"
      />
      <span className="flex-1">
        <span className="block text-sm font-medium text-white">{label}</span>
        <span className="mt-0.5 block text-xs text-slate-400">{description}</span>
      </span>
    </label>
  );
}

function NumberField({
  name,
  label,
  defaultValue,
  min,
  max,
}: {
  name: string;
  label: string;
  defaultValue: number;
  min: number;
  max: number;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-xs font-medium text-slate-300">
        {label}
      </label>
      <Input
        id={name}
        name={name}
        type="number"
        defaultValue={defaultValue}
        min={min}
        max={max}
      />
    </div>
  );
}
