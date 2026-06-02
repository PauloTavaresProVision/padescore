import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LinkButton } from "@/components/ui/Button";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "@/components/icons";
import {
  CourtsManager,
  type CourtRow,
} from "@/components/admin/CourtsManager";

export const dynamic = "force-dynamic";

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const { data: matches } = await supabase
    .from("matches")
    .select(
      "id, short_code, court_name, court_id, scheduled_at, team_a_player1, team_a_player2, team_b_player1, team_b_player2, status, golden_point, created_at",
    )
    .eq("tournament_id", id)
    .order("created_at", { ascending: false });

  // Estados actuais (para mostrar score na lista)
  const matchIds = (matches ?? []).map((m) => m.id);
  const states = matchIds.length
    ? (
        await supabase
          .from("match_state")
          .select("match_id, sets_a, sets_b, games_a, games_b, points_a, points_b, in_tiebreak, in_super_tiebreak")
          .in("match_id", matchIds)
      ).data ?? []
    : [];
  const stateByMatch = new Map(states.map((s) => [s.match_id, s]));

  const liveCount = matches?.filter((m) => m.status === "live").length ?? 0;
  const finishedCount = matches?.filter((m) => m.status === "finished").length ?? 0;
  const scheduledCount = matches?.filter((m) => m.status === "scheduled").length ?? 0;

  // Lista de campos do torneio + contagem de jogos por campo (para mostrar
  // ao user quantos jogos cada campo tem e bloquear delete se >0).
  const { data: courtsRaw } = await supabase
    .from("courts")
    .select("id, name, sort_order")
    .eq("tournament_id", id)
    .order("sort_order", { ascending: true });
  const matchesByCourt = new Map<string, number>();
  for (const m of matches ?? []) {
    const cid = (m as { court_id?: string | null }).court_id ?? null;
    if (cid) matchesByCourt.set(cid, (matchesByCourt.get(cid) ?? 0) + 1);
  }
  const courts: CourtRow[] = (courtsRaw ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    sort_order: c.sort_order,
    matchCount: matchesByCourt.get(c.id) ?? 0,
  }));

  return (
    <div>
      <Link
        href="/admin/tournaments"
        className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-900"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Torneios
      </Link>

      {/* Hero */}
      <div className="mt-4 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/80 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
        <div
          className="h-2 w-full"
          style={{ background: tournament.primary_color ?? "#10b981" }}
        />
        <div className="flex flex-wrap items-center gap-6 p-6">
          <div
            className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-slate-100"
            style={{ boxShadow: `inset 0 0 0 2px ${tournament.primary_color ?? "#10b981"}50` }}
          >
            {tournament.logo_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={tournament.logo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-slate-400">
                {tournament.name.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <h1 className="truncate text-3xl font-extrabold tracking-tight text-slate-900">{tournament.name}</h1>
              <Link
                href={`/admin/tournaments/${id}/edit`}
                className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900"
              >
                Editar
              </Link>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
              <Stat label="Total" value={matches?.length ?? 0} />
              <Stat label="Ao vivo" value={liveCount} accent />
              <Stat label="Agendados" value={scheduledCount} />
              <Stat label="Terminados" value={finishedCount} dim />
            </div>
          </div>
        </div>
      </div>

      {/* Campos */}
      <div className="mt-10 mb-4">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-slate-900">Campos</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Define os campos do torneio. Cada jogo é atribuído a um campo (e cada totem corresponde a um campo).
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link
              href={`/admin/tournaments/${id}/sponsors`}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900"
            >
              Sponsors →
            </Link>
            <Link
              href={`/admin/tournaments/${id}/totens`}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900"
            >
              Totens →
            </Link>
          </div>
        </div>
        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
          <CourtsManager tournamentId={id} initialCourts={courts} />
        </div>
      </div>

      {/* Jogos */}
      <div className="mt-10 mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900">Jogos</h2>
          <p className="mt-0.5 text-sm text-slate-500">Cada jogo gera um link único para o operador.</p>
        </div>
        <LinkButton href={`/admin/tournaments/${id}/matches/new`}>
          <PlusIcon className="h-4 w-4" />
          Novo jogo
        </LinkButton>
      </div>

      {!matches?.length ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-sm text-slate-500">Sem jogos ainda.</p>
        </div>
      ) : (
        (() => {
          // Agrupa por court_id; jogos sem campo vão para 'orphans'.
          const byCourt = new Map<string, typeof matches>();
          const orphans: typeof matches = [];
          for (const m of matches) {
            const cid = m.court_id;
            if (cid) {
              if (!byCourt.has(cid)) byCourt.set(cid, []);
              byCourt.get(cid)!.push(m);
            } else {
              orphans.push(m);
            }
          }
          // Dentro de cada campo: scheduled_at ASC (sem horário no fim),
          // empate desempata por created_at DESC (mais recentes primeiro).
          const sortMatches = (list: typeof matches) =>
            [...list].sort((a, b) => {
              if (a.scheduled_at && b.scheduled_at) {
                return a.scheduled_at.localeCompare(b.scheduled_at);
              }
              if (a.scheduled_at) return -1;
              if (b.scheduled_at) return 1;
              return b.created_at.localeCompare(a.created_at);
            });

          // Helper p/ data legível ("Hoje 18:00" / "Amanhã 18:00" / "22 Mai 18:00")
          function formatScheduled(iso: string | null): { date: string; time: string } {
            if (!iso) return { date: "Sem horário", time: "" };
            const d = new Date(iso);
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const tomorrow = new Date(today.getTime() + 86400000);
            const matchDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const pad = (n: number) => String(n).padStart(2, "0");
            const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
            let date: string;
            if (matchDay.getTime() === today.getTime()) date = "Hoje";
            else if (matchDay.getTime() === tomorrow.getTime()) date = "Amanhã";
            else {
              const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
              date = `${d.getDate()} ${months[d.getMonth()]}`;
            }
            return { date, time };
          }

          const renderMatch = (m: (typeof matches)[number]) => {
            const teamA = [m.team_a_player1, m.team_a_player2].filter(Boolean).join(" / ");
            const teamB = [m.team_b_player1, m.team_b_player2].filter(Boolean).join(" / ");
            const s = stateByMatch.get(m.id);
            const sch = formatScheduled(m.scheduled_at);
            return (
              <li key={m.id} className="border-t border-slate-100 first:border-t-0">
                <Link
                  href={`/admin/tournaments/${id}/matches/${m.id}`}
                  className="group flex items-center gap-4 p-4 transition hover:bg-slate-50"
                >
                  <div className="w-20 shrink-0 text-center">
                    {m.scheduled_at ? (
                      <>
                        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                          {sch.date}
                        </div>
                        <div className="font-mono text-lg font-bold tabular-nums text-slate-900">
                          {sch.time}
                        </div>
                      </>
                    ) : (
                      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        Sem horário
                      </div>
                    )}
                  </div>

                  <StatusDot status={m.status} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 text-xs text-slate-500">
                      <span>{m.golden_point ? "Golden point" : "Vantagens"}</span>
                      {m.short_code && (
                        <>
                          <span>·</span>
                          <span className="font-mono uppercase tracking-widest text-slate-400">
                            #{m.short_code}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold text-slate-900">
                      {teamA} <span className="px-1 text-slate-400">vs</span> {teamB}
                    </div>
                  </div>

                  {s && (
                    <div className="hidden items-baseline gap-3 font-mono text-sm sm:flex">
                      <ScorePair a={s.sets_a} b={s.sets_b} label="Sets" />
                      <ScorePair a={s.games_a} b={s.games_b} label="Games" />
                      <ScorePair a={s.points_a} b={s.points_b} label="Pts" accent={s.in_tiebreak || s.in_super_tiebreak} />
                    </div>
                  )}

                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
                </Link>
              </li>
            );
          };

          return (
            <div className="space-y-6">
              {courts.map((c) => {
                const list = sortMatches(byCourt.get(c.id) ?? []);
                if (list.length === 0) {
                  return (
                    <div key={c.id}>
                      <div className="mb-2 flex items-baseline justify-between">
                        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
                          {c.name}
                        </h3>
                        <span className="text-xs text-slate-400">sem jogos</span>
                      </div>
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                        Ainda não há jogos marcados para este campo.
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={c.id}>
                    <div className="mb-2 flex items-baseline justify-between">
                      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
                        {c.name}
                      </h3>
                      <span className="text-xs font-medium text-slate-500">
                        {list.length} {list.length === 1 ? "jogo" : "jogos"}
                      </span>
                    </div>
                    <ul className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/80 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
                      {list.map(renderMatch)}
                    </ul>
                  </div>
                );
              })}

              {orphans.length > 0 && (
                <div>
                  <div className="mb-2 flex items-baseline justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-amber-700">
                      Sem campo atribuído
                    </h3>
                    <span className="text-xs font-medium text-amber-600">
                      {orphans.length} {orphans.length === 1 ? "jogo" : "jogos"} — edita para escolher campo
                    </span>
                  </div>
                  <ul className="overflow-hidden rounded-2xl bg-white ring-1 ring-amber-200 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
                    {sortMatches(orphans).map(renderMatch)}
                  </ul>
                </div>
              )}
            </div>
          );
        })()
      )}
    </div>
  );
}

function Stat({ label, value, accent, dim }: { label: string; value: number; accent?: boolean; dim?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span
        className={[
          "text-2xl font-bold",
          accent ? "text-emerald-600" : dim ? "text-slate-400" : "text-slate-900",
        ].join(" ")}
      >
        {value}
      </span>
      <span className="text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
      {accent && value > 0 && (
        <span className="relative ml-0.5 inline-block h-2 w-2">
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60" />
          <span className="absolute inset-0 rounded-full bg-emerald-400" />
        </span>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    live: "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]",
    scheduled: "bg-amber-400",
    finished: "bg-slate-300",
  };
  return <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${colors[status] ?? "bg-slate-300"}`} />;
}

function ScorePair({ a, b, label, accent }: { a: string | number; b: string | number; label: string; accent?: boolean }) {
  return (
    <div className="text-right">
      <div className={`tabular-nums ${accent ? "text-amber-600" : "text-slate-700"}`}>
        {a} <span className="text-slate-400">·</span> {b}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}
