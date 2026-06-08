import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getCompetitionSnapshot,
  combineGameDateTime,
} from "@/lib/padelteams/client";
import { PedidosClient, type GameForUI } from "./PedidosClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ code: string }>;
}

/**
 * Página PÚBLICA para jogadores submeterem pedidos de alteração de horário.
 *
 * URL: /pedidos/{competition_code}
 *
 * Sem login. Lista todos os jogos do PadelTeams agrupados por categoria
 * (F1, F2, F3, M1-M4...). Cada jogo tem botão "Pedir alteração" que abre
 * form com nome + telemóvel + motivo + nova proposta.
 *
 * O submit vai para POST /api/reschedule-request (validações + rate-limit).
 */
export default async function PedidosPage({ params }: PageProps) {
  const { code } = await params;
  if (!code || code.length < 3) notFound();

  const supabase = createAdminClient();
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, logo_url, primary_color")
    .eq("padelteams_competition_code", code)
    .maybeSingle();
  if (!tournament) notFound();

  // Buscar snapshot do PadelTeams (cached 30s)
  let snapshot: Awaited<ReturnType<typeof getCompetitionSnapshot>> | null = null;
  let fetchError: string | null = null;
  try {
    snapshot = await getCompetitionSnapshot(code);
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "Erro desconhecido";
  }

  if (!snapshot || snapshot.games.length === 0) {
    return (
      <div
        className="min-h-screen bg-slate-50 px-4 py-10"
        style={{ background: `linear-gradient(180deg, ${tournament.primary_color ?? "#10b981"}10, #f8fafc)` }}
      >
        <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          {tournament.logo_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={tournament.logo_url}
              alt={tournament.name}
              className="mx-auto mb-4 h-20 w-20 rounded-2xl object-contain"
            />
          )}
          <h1 className="text-2xl font-bold text-slate-900">
            {tournament.name}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Pedidos de alteração de horário
          </p>
          <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            {fetchError ? (
              <>
                <b>Erro ao carregar jogos do PadelTeams</b>
                <p className="mt-1 text-xs">{fetchError}</p>
              </>
            ) : (
              <>
                <b>Ainda não há jogos definidos</b>
                <p className="mt-1 text-xs">
                  Volta mais tarde quando o organizador publicar os horários.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Construir lookup tournament_id → category name
  // (o PadelTeams game não tem tournament_id directo no payload, mas
  // sabemos que cada game vem de algum dos snapshot.tournaments — vamos
  // por field.tournament_name se existir, senão "Outros")
  // Em alternativa, agrupamos por initial letter do "name" das equipas se
  // tiver pattern tipo "F1-...". Mais simples: agrupar por field.description.

  // Como o PadelTeamsGame não traz tournament_id, agrupamos por initial
  // letter via heurística (F1 / F2 / M1 / etc) que aparece muitas vezes
  // no campo name das teams ou descrição. Como fallback, agrupamos por
  // field.description.
  const games: GameForUI[] = snapshot.games.map((g) => ({
    id: g.id,
    scheduledAt: combineGameDateTime(g).toISOString(),
    field: g.field?.description ?? "—",
    teamA:
      g.team1.players.map((p) => p.name).join(" / ") || g.team1.name || "—",
    teamB:
      g.team2.players.map((p) => p.name).join(" / ") || g.team2.name || "—",
    status: g.status,
  }));

  // Ordenar por data ascending
  games.sort(
    (a, b) =>
      new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  );

  return (
    <div
      className="min-h-screen px-3 py-6 sm:px-4 sm:py-10"
      style={{
        background: `linear-gradient(180deg, ${tournament.primary_color ?? "#10b981"}10, #f8fafc)`,
      }}
    >
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 text-center">
          {tournament.logo_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={tournament.logo_url}
              alt={tournament.name}
              className="mx-auto mb-3 h-16 w-16 rounded-xl object-contain"
            />
          )}
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {tournament.name}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Pedidos de alteração de horário
          </p>
        </header>

        <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <p className="font-semibold">Como funciona:</p>
          <ol className="ml-4 mt-1 list-decimal space-y-0.5 text-xs">
            <li>Encontra o teu jogo na lista abaixo</li>
            <li>Clica em <b>&ldquo;Pedir alteração&rdquo;</b> e preenche o motivo</li>
            <li>O clube vai avaliar e responder. Vais ser contactado.</li>
          </ol>
        </div>

        <PedidosClient competitionCode={code} games={games} />
      </div>
    </div>
  );
}
