import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateMatch } from "../actions";
import { Input } from "@/components/ui/Input";
import { Button, LinkButton } from "@/components/ui/Button";
import { Fieldset } from "@/components/ui/Card";
import { ChevronLeftIcon } from "@/components/icons";
import {
  MatchPlayerPicker,
  type PlayerOption,
  type InitialData,
} from "@/components/admin/MatchPlayerPicker";

export const dynamic = "force-dynamic";

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

export default async function EditMatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; matchId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id: tournamentId, matchId } = await params;
  const sp = await searchParams;

  const supabase = await createClient();
  const [{ data: match }, { data: playersRaw }, { data: courtsRaw }] =
    await Promise.all([
      supabase.from("matches").select("*").eq("id", matchId).single(),
      supabase
        .from("players")
        .select("id, name, short_name, photo_url, mirror")
        .order("name", { ascending: true }),
      supabase
        .from("courts")
        .select("id, name")
        .eq("tournament_id", tournamentId)
        .order("sort_order", { ascending: true }),
    ]);

  if (!match) notFound();
  const players: PlayerOption[] = playersRaw ?? [];
  const courts = courtsRaw ?? [];

  // Para o input datetime-local: queremos "YYYY-MM-DDTHH:MM" na timezone
  // local do browser. Em SSR a "local" é a timezone do servidor — para
  // evitar mismatch, formatamos UTC e o browser ajusta na exibição. Se o
  // user editar, o input devolve em local (o action converte para ISO).
  function toDatetimeLocal(iso: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const scheduledDefault = toDatetimeLocal(match.scheduled_at ?? null);

  const initial: InitialData = {
    a1: {
      name: match.team_a_player1 ?? "",
      shortName: match.team_a_player1_short ?? "",
      playerId: match.team_a_player1_id ?? null,
    },
    a2: {
      name: match.team_a_player2 ?? "",
      shortName: match.team_a_player2_short ?? "",
      playerId: match.team_a_player2_id ?? null,
    },
    b1: {
      name: match.team_b_player1 ?? "",
      shortName: match.team_b_player1_short ?? "",
      playerId: match.team_b_player1_id ?? null,
    },
    b2: {
      name: match.team_b_player2 ?? "",
      shortName: match.team_b_player2_short ?? "",
      playerId: match.team_b_player2_id ?? null,
    },
    hasComposites: Boolean(match.team_a_photo_url || match.team_b_photo_url),
  };

  const updateMatchBound = updateMatch.bind(null, tournamentId, matchId);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/admin/tournaments/${tournamentId}/matches/${matchId}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-900"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Voltar ao jogo
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Editar jogo</h1>
      <p className="mt-1 text-sm text-slate-500">
        Corrige court, categoria, jogadores ou fotos. As fotos actuais
        mantêm-se a não ser que recomponhas.
      </p>

      {sp.error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {sp.error}
        </div>
      )}

      <form action={updateMatchBound} className="mt-8 space-y-6">
        <Fieldset legend="Informação geral">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="court_id" className="mb-1.5 block text-sm font-medium text-slate-700">
                Campo
              </label>
              <select
                id="court_id"
                name="court_id"
                required
                defaultValue={match.court_id ?? ""}
                disabled={courts.length === 0}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition hover:border-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 disabled:opacity-50"
              >
                {courts.length === 0 ? (
                  <option value="">— Cria um campo primeiro —</option>
                ) : (
                  <>
                    <option value="">— Escolhe campo —</option>
                    {courts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
            <div>
              <label htmlFor="category" className="mb-1.5 block text-sm font-medium text-slate-700">
                Categoria
              </label>
              <select
                id="category"
                name="category"
                defaultValue={match.category ?? ""}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition hover:border-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
              >
                <option value="">— Sem categoria —</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="scheduled_at" className="mb-1.5 block text-sm font-medium text-slate-700">
                Horário marcado <span className="text-xs font-normal text-slate-500">(opcional — aparece no totem)</span>
              </label>
              <Input
                id="scheduled_at"
                name="scheduled_at"
                type="datetime-local"
                defaultValue={scheduledDefault}
              />
            </div>
          </div>
        </Fieldset>

        <MatchPlayerPicker players={players} initial={initial} />

        <Fieldset legend="Regras" hint="Alterar regras a meio só tem efeito se reiniciares o jogo.">
          <Toggle
            name="golden_point"
            defaultChecked={match.golden_point}
            label="Golden point (morte súbita)"
            description="Em 40-40, o próximo ponto ganha o game. Desliga para jogar com vantagens (AD)."
          />
          <Toggle
            name="final_set_super_tiebreak"
            defaultChecked={match.final_set_super_tiebreak}
            label="Set decisivo com super tiebreak (a 10)"
            description="No último set, substitui por um tiebreak a 10 pontos."
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField name="sets_to_win" label="Sets para ganhar" defaultValue={match.sets_to_win} min={1} max={3} />
            <NumberField name="games_per_set" label="Games por set" defaultValue={match.games_per_set} min={4} max={9} />
            <NumberField name="tiebreak_at" label="Tiebreak em" defaultValue={match.tiebreak_at} min={4} max={9} />
            <NumberField name="tiebreak_points" label="Pontos do tiebreak" defaultValue={match.tiebreak_points} min={5} max={15} />
          </div>
        </Fieldset>

        <div className="flex justify-end gap-3 pt-2">
          <LinkButton href={`/admin/tournaments/${tournamentId}/matches/${matchId}`} variant="secondary">
            Cancelar
          </LinkButton>
          <Button type="submit">Guardar alterações</Button>
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
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-slate-100">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span className="relative mt-0.5 inline-block h-5 w-9 shrink-0 rounded-full bg-slate-300 transition before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white before:shadow-sm before:transition peer-checked:bg-emerald-500 peer-checked:before:translate-x-4" />
      <span className="flex-1">
        <span className="block text-sm font-semibold text-slate-900">{label}</span>
        <span className="mt-0.5 block text-xs text-slate-500">{description}</span>
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
      <label htmlFor={name} className="mb-1.5 block text-xs font-medium text-slate-600">
        {label}
      </label>
      <Input id={name} name={name} type="number" defaultValue={defaultValue} min={min} max={max} />
    </div>
  );
}
