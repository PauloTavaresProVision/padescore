import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChevronLeftIcon } from "@/components/icons";
import { getCompetitionSnapshot } from "@/lib/padelteams/client";
import { toggleFeatured } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Admin: Marcar jogos como DESTAQUE (is_featured).
 *
 * O cavalete Cena 2 "EM FOCO" usa este flag para escolher quais jogos
 * mostrar no carrossel de fotos dos jogadores. Lista todos os jogos do
 * PadelTeams (snapshot) com checkbox de "destacar".
 */
export default async function FeaturedGamesPage({
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

  // Buscar overrides existentes (lookup: game_id → is_featured)
  const { data: overridesRaw } = await supabase
    .from("padelteams_game_overrides")
    .select("padelteams_game_id, is_featured")
    .eq("tournament_id", tournamentId);
  const featuredSet = new Set<number>(
    (overridesRaw ?? [])
      .filter((o) => o.is_featured)
      .map((o) => o.padelteams_game_id),
  );

  // Buscar snapshot do PadelTeams (jogos + competition info)
  let snapshot: Awaited<ReturnType<typeof getCompetitionSnapshot>> | null = null;
  let fetchError: string | null = null;
  if (tournament.padelteams_competition_code) {
    try {
      snapshot = await getCompetitionSnapshot(
        tournament.padelteams_competition_code,
      );
    } catch (e) {
      fetchError = e instanceof Error ? e.message : "Erro desconhecido";
    }
  }

  // Ordenar jogos: featured primeiro, depois por data ascending
  const games = snapshot?.games ?? [];
  const sortedGames = [...games].sort((a, b) => {
    const aFeat = featuredSet.has(a.id) ? 0 : 1;
    const bFeat = featuredSet.has(b.id) ? 0 : 1;
    if (aFeat !== bFeat) return aFeat - bFeat;
    return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
  });

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
        Jogos em Destaque
      </h1>
      <p className="mt-1 mb-6 max-w-2xl text-sm text-slate-500">
        Marca jogos para aparecerem na <b>Cena 2 — EM FOCO</b> do cavalete
        (carrossel com fotos das duplas). Tipicamente: jogos das duplas
        favoritas, finais, semifinais.
      </p>

      {sp.error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {sp.error.replace(/\+/g, " ")}
        </div>
      )}
      {sp.ok && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          ✓ {sp.ok.replace(/\+/g, " ")}
        </div>
      )}

      {!tournament.padelteams_competition_code && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <b className="block mb-1">Sem PadelTeams configurado</b>
          Primeiro configura o código da competição em{" "}
          <Link
            href={`/admin/tournaments/${tournamentId}/padelteams`}
            className="font-bold underline"
          >
            Integração PadelTeams
          </Link>
          .
        </div>
      )}

      {fetchError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
          <b className="block mb-1">Erro a contactar PadelTeams</b>
          {fetchError}
        </div>
      )}

      {snapshot && games.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
          A competição ainda não tem jogos definidos no PadelTeams.
        </div>
      )}

      {snapshot && games.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/80 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
          <div className="border-b border-slate-200 px-4 py-3 text-xs text-slate-500">
            {games.length} jogos no PadelTeams ·{" "}
            <b className="text-slate-700">{featuredSet.size} em destaque</b>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 w-20">Destaque</th>
                <th className="px-4 py-3 w-32">Quando</th>
                <th className="px-4 py-3 w-28">Campo</th>
                <th className="px-4 py-3">Dupla A</th>
                <th className="px-4 py-3"></th>
                <th className="px-4 py-3">Dupla B</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedGames.map((g) => {
                const isFeatured = featuredSet.has(g.id);
                const d = new Date(g.scheduled_at);
                return (
                  <tr
                    key={g.id}
                    className={isFeatured ? "bg-amber-50/50" : ""}
                  >
                    <td className="px-4 py-3">
                      <form action={toggleFeatured.bind(null, tournamentId)}>
                        <input type="hidden" name="game_id" value={g.id} />
                        <input
                          type="hidden"
                          name="featured"
                          value={isFeatured ? "false" : "true"}
                        />
                        <button
                          type="submit"
                          className={`grid h-9 w-9 place-items-center rounded-lg border-2 transition ${
                            isFeatured
                              ? "border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200"
                              : "border-slate-200 bg-white text-slate-300 hover:border-amber-300 hover:text-amber-500"
                          }`}
                          title={
                            isFeatured ? "Remover destaque" : "Marcar destaque"
                          }
                        >
                          ★
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <div className="font-semibold text-slate-900">
                        {d.toLocaleDateString("pt-PT", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </div>
                      <div>
                        {String(d.getHours()).padStart(2, "0")}:
                        {String(d.getMinutes()).padStart(2, "0")}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {g.field?.description ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {g.team1.players.map((p) => p.name).join(" / ") ||
                        g.team1.name}
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-400">
                      VS
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {g.team2.players.map((p) => p.name).join(" / ") ||
                        g.team2.name}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
