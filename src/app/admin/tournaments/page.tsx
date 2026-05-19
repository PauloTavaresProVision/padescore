import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PlusIcon, TrophyIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

const CARD =
  "rounded-2xl bg-white ring-1 ring-slate-200/80 shadow-[0_1px_3px_rgba(16,24,40,0.06),0_1px_2px_rgba(16,24,40,0.04)]";

export default async function TournamentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: tournaments, error } = await supabase
    .from("tournaments")
    .select("id, name, logo_url, primary_color, created_at")
    .eq("owner_id", user!.id)
    .order("created_at", { ascending: false });

  const list = tournaments ?? [];
  let counts: Record<string, { total: number; live: number }> = {};
  if (list.length) {
    const { data: matches } = await supabase
      .from("matches")
      .select("tournament_id, status")
      .in("tournament_id", list.map((t) => t.id));
    counts = (matches ?? []).reduce<typeof counts>((acc, m) => {
      const c = acc[m.tournament_id] ?? { total: 0, live: 0 };
      c.total += 1;
      if (m.status === "live") c.live += 1;
      acc[m.tournament_id] = c;
      return acc;
    }, {});
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600">
            Backoffice
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
            Torneios
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Cada torneio agrupa jogos com o mesmo branding e fundo de TV.
          </p>
        </div>
        <Link
          href="/admin/tournaments/new"
          className="inline-flex items-center gap-2 rounded-xl bg-lime-400 px-5 py-3 text-sm font-extrabold text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-lime-300"
        >
          <PlusIcon className="h-4 w-4" strokeWidth={2.6} />
          Novo torneio
        </Link>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error.message}
        </div>
      )}

      {list.length === 0 ? (
        <div className={`mt-8 ${CARD} p-16 text-center`}>
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
            <TrophyIcon className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-900">
            Ainda sem torneios
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
            Cria o primeiro torneio para começares a registar jogos.
          </p>
          <Link
            href="/admin/tournaments/new"
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-lime-400 px-5 py-3 text-sm font-extrabold text-slate-900 transition hover:bg-lime-300"
          >
            <PlusIcon className="h-4 w-4" strokeWidth={2.6} />
            Criar primeiro torneio
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((t) => {
            const color = t.primary_color ?? "#84cc16";
            const c = counts[t.id] ?? { total: 0, live: 0 };
            return (
              <Link
                key={t.id}
                href={`/admin/tournaments/${t.id}`}
                className={`group relative flex flex-col overflow-hidden ${CARD} transition duration-200 hover:-translate-y-1 hover:shadow-lg`}
              >
                <div className="h-1.5 w-full" style={{ background: color }} />
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start gap-3.5">
                    {t.logo_url ? (
                      <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-slate-50 ring-1 ring-slate-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={t.logo_url}
                          alt=""
                          className="h-full w-full object-contain p-1.5"
                        />
                      </span>
                    ) : (
                      <span
                        className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-xl font-extrabold text-white"
                        style={{ background: color }}
                      >
                        {t.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 flex-1 pt-1">
                      <h3 className="truncate text-base font-bold tracking-tight text-slate-900">
                        {t.name}
                      </h3>
                      <p className="mt-0.5 text-xs font-medium text-slate-500">
                        {new Date(t.created_at).toLocaleDateString("pt-PT", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="mt-auto flex items-center gap-5 border-t border-slate-100 pt-4">
                    <span className="flex items-center gap-2 text-sm">
                      <b className="font-extrabold text-slate-900">{c.total}</b>
                      <span className="text-xs font-medium text-slate-500">
                        {c.total === 1 ? "jogo" : "jogos"}
                      </span>
                    </span>
                    {c.live > 0 && (
                      <span className="flex items-center gap-2 text-sm">
                        <span className="relative inline-flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/60" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                        </span>
                        <b className="font-extrabold text-emerald-600">{c.live}</b>
                        <span className="text-xs font-semibold text-emerald-600/80">
                          ao vivo
                        </span>
                      </span>
                    )}
                    <span className="ml-auto text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500">
                      ›
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}

          <Link
            href="/admin/tournaments/new"
            className="group flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/60 text-slate-400 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-600"
          >
            <span className="grid h-14 w-14 place-items-center rounded-2xl border border-current">
              <PlusIcon className="h-6 w-6" strokeWidth={2.4} />
            </span>
            <span className="text-sm font-bold">Criar torneio</span>
          </Link>
        </div>
      )}
    </div>
  );
}
