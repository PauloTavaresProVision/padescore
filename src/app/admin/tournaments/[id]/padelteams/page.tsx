import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChevronLeftIcon } from "@/components/icons";
import {
  getCompetitionSnapshot,
  type PadelTeamsField,
} from "@/lib/padelteams/client";
import { setCompetitionCode, autoMatchFields } from "./actions";
import { FieldMapper } from "./FieldMapper";

export const dynamic = "force-dynamic";

interface Court {
  id: string;
  name: string;
  sort_order: number;
  padelteams_field_id: number | null;
}

export default async function PadelTeamsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { id: tournamentId } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, owner_id, padelteams_competition_code")
    .eq("id", tournamentId)
    .single();
  if (!tournament) notFound();
  if (tournament.owner_id !== user.id) redirect("/admin");

  const { data: courtsRaw } = await supabase
    .from("courts")
    .select("id, name, sort_order, padelteams_field_id")
    .eq("tournament_id", tournamentId)
    .order("sort_order");
  const courts = (courtsRaw ?? []) as Court[];

  // Se tem competition_code, vamos buscar os fields do PadelTeams.
  let competitionInfo: {
    name: string;
    dateFrom: string;
    dateTo: string;
  } | null = null;
  let padelteamsFields: PadelTeamsField[] = [];
  let fetchError: string | null = null;

  if (tournament.padelteams_competition_code) {
    try {
      const snapshot = await getCompetitionSnapshot(
        tournament.padelteams_competition_code,
      );
      competitionInfo = {
        name: snapshot.competition.name,
        dateFrom: snapshot.competition.date_from,
        dateTo: snapshot.competition.date_to,
      };
      // Unique fields, ordenados pelo "description" (ex: "Campo 1", "Campo 2")
      const seen = new Map<number, PadelTeamsField>();
      for (const g of snapshot.games) {
        if (g.field) seen.set(g.field.id, g.field);
      }
      padelteamsFields = [...seen.values()].sort((a, b) =>
        (a.description ?? "").localeCompare(b.description ?? ""),
      );
    } catch (e) {
      fetchError = e instanceof Error ? e.message : "Erro desconhecido";
    }
  }

  const unmappedCount = courts.filter((c) => !c.padelteams_field_id).length;

  return (
    <div>
      <Link
        href={`/admin/tournaments/${tournamentId}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-900"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Voltar ao torneio
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">
        Integração PadelTeams
      </h1>
      <p className="mt-1 mb-6 max-w-2xl text-sm text-slate-500">
        Liga este torneio à competição no PadelTeams e associa cada campo
        nosso ao campo correspondente lá. Depois disto, o cavalete passa a
        mostrar automaticamente os jogos, próximos e resultados (zero
        trabalho manual diário).
      </p>

      {sp.error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {sp.error}
        </div>
      )}
      {sp.ok && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          ✓ {sp.ok.replace(/\+/g, " ")}
        </div>
      )}

      {/* 1) Competição */}
      <section className="mb-8 rounded-2xl bg-white p-5 ring-1 ring-slate-200/80 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
        <h2 className="mb-1 text-base font-bold text-slate-900">
          1. Código da competição
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          O código que o PadelTeams te enviou (parte do URL{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px]">
            ?code=XXXX
          </code>
          ).
        </p>
        <form action={setCompetitionCode.bind(null, tournamentId)}>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              name="competition_code"
              defaultValue={tournament.padelteams_competition_code ?? ""}
              placeholder="ex: ywihky"
              required
              maxLength={64}
              className="rounded border border-slate-300 px-3 py-2 font-mono text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            <button
              type="submit"
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              {tournament.padelteams_competition_code
                ? "Actualizar código"
                : "Guardar código"}
            </button>
          </div>

          {competitionInfo && (
            <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm">
              <div className="font-semibold text-slate-900">
                {competitionInfo.name}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {competitionInfo.dateFrom} → {competitionInfo.dateTo}
                {" · "}
                {padelteamsFields.length} campos encontrados
              </div>
            </div>
          )}

          {fetchError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              ❌ {fetchError}
            </div>
          )}
        </form>
      </section>

      {/* 2) Mapping de campos */}
      {tournament.padelteams_competition_code && !fetchError && (
        <section className="mb-8 rounded-2xl bg-white p-5 ring-1 ring-slate-200/80 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="mb-1 text-base font-bold text-slate-900">
                2. Associar campos
              </h2>
              <p className="text-xs text-slate-500">
                {courts.length} campos nossos · {padelteamsFields.length}{" "}
                campos no PadelTeams ·{" "}
                <b className="text-slate-700">
                  {unmappedCount} por associar
                </b>
              </p>
            </div>
            {unmappedCount > 0 && (
              <form action={autoMatchFields.bind(null, tournamentId)}>
                <button
                  type="submit"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  title="Tenta auto-match por nome (case-insensitive, ignora acentos)"
                >
                  ⚡ Auto-match por nome
                </button>
              </form>
            )}
          </div>

          {courts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              Ainda não tens campos definidos. Cria primeiro em{" "}
              <Link
                href={`/admin/tournaments/${tournamentId}`}
                className="font-semibold underline"
              >
                página do torneio
              </Link>
              .
            </div>
          ) : (
            <FieldMapper
              tournamentId={tournamentId}
              courts={courts}
              padelteamsFields={padelteamsFields}
            />
          )}
        </section>
      )}
    </div>
  );
}
