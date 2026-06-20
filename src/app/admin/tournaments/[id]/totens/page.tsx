import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ChevronLeftIcon } from "@/components/icons";
import { CavaletesManager } from "./CavaletesManager";
import { setFinalsMode } from "./actions";

export const dynamic = "force-dynamic";

export default async function TotensPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
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
    .select("id, name, owner_id")
    .eq("id", tournamentId)
    .single();
  if (!tournament) notFound();
  if (tournament.owner_id !== user.id) redirect("/admin");

  const [{ data: courts }, { data: totems }, { data: finalsRow }] =
    await Promise.all([
      supabase
        .from("courts")
        .select("id, name, sort_order")
        .eq("tournament_id", tournamentId)
        .order("sort_order"),
      supabase
        .from("totems")
        .select(
          "id, court_id, court_id_2, name, api_token, last_seen_at, created_at",
        )
        .eq("tournament_id", tournamentId)
        .order("created_at"),
      // Resiliente: se a coluna ainda não existe (migration 0022 por aplicar),
      // o erro é ignorado e finalsMode fica false.
      supabase
        .from("tournaments")
        .select("cavalete_finals_mode")
        .eq("id", tournamentId)
        .maybeSingle(),
    ]);
  const finalsMode =
    (finalsRow as { cavalete_finals_mode?: boolean } | null)
      ?.cavalete_finals_mode ?? false;

  // Base URL para construir o URL do endpoint (que o operador cola na app)
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;

  const courtsList = courts ?? [];
  const courtById = new Map(courtsList.map((c) => [c.id, c]));

  const cavaletes = (totems ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    apiToken: t.api_token,
    apiUrl: `${baseUrl}/api/cavalete/${t.api_token}`,
    lastSeenAt: t.last_seen_at,
    court1: courtById.get(t.court_id) ?? null,
    court2: t.court_id_2 ? courtById.get(t.court_id_2) ?? null : null,
  }));

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
        Cavaletes
      </h1>
      <p className="mt-1 mb-6 max-w-2xl text-sm text-slate-500">
        Cada cavalete corresponde a um dispositivo Windows físico (PC com
        ecrã 1080×1920 portrait). Cada cavalete mostra <b>1 ou 2 campos</b>:
        EM JOGO AGORA, próximos e resultados. Copia o token (16 caracteres)
        e cola na app <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px]">PadescoreTotem.exe</code> do PC do cavalete.
      </p>

      {sp.error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {sp.error}
        </div>
      )}

      {/* Modo Finais — interruptor que põe todos os cavaletes a mostrar só os
          cartazes das finais (jogos em destaque). */}
      <div
        className={`mb-6 flex flex-col gap-3 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between ${
          finalsMode
            ? "border-amber-300 bg-amber-50"
            : "border-slate-200 bg-slate-50"
        }`}
      >
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                finalsMode ? "bg-amber-500" : "bg-slate-300"
              }`}
            />
            <h2 className="text-base font-bold text-slate-900">
              Modo Finais {finalsMode ? "— ATIVO" : ""}
            </h2>
          </div>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            {finalsMode
              ? "Os cavaletes estão a mostrar só os cartazes das finais (jogos em destaque). A rotação normal (jogos do dia, resultados, patrocinadores) está escondida."
              : "Quando ligado, todos os cavaletes mostram só os cartazes das finais (PRÓXIMO JOGO / RESULTADO EM ANDAMENTO dos jogos marcados como destaque). Liga isto quando começarem as finais."}
          </p>
        </div>
        <form action={setFinalsMode.bind(null, tournamentId, !finalsMode)}>
          <button
            type="submit"
            className={`shrink-0 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm transition ${
              finalsMode
                ? "bg-slate-700 hover:bg-slate-800"
                : "bg-amber-500 hover:bg-amber-600"
            }`}
          >
            {finalsMode ? "Desativar Finais" : "Ativar Finais"}
          </button>
        </form>
      </div>

      {courtsList.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-8 text-center">
          <p className="text-sm text-amber-900">
            Ainda não tens campos definidos. Cria primeiro em{" "}
            <Link
              href={`/admin/tournaments/${tournamentId}`}
              className="font-semibold underline"
            >
              página do torneio
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
          <CavaletesManager
            tournamentId={tournamentId}
            courts={courtsList}
            cavaletes={cavaletes}
          />
        </div>
      )}
    </div>
  );
}
