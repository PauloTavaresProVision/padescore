import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LinkButton } from "@/components/ui/Button";
import { PlusIcon, TrophyIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: tournaments, error } = await supabase
    .from("tournaments")
    .select("id, name, logo_url, primary_color, created_at")
    .eq("owner_id", user!.id)
    .order("created_at", { ascending: false });

  // contagem de jogos por torneio (para mostrar nos cards)
  let counts: Record<string, { total: number; live: number }> = {};
  if (tournaments?.length) {
    const { data: matches } = await supabase
      .from("matches")
      .select("tournament_id, status")
      .in("tournament_id", tournaments.map((t) => t.id));
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
      {/* Header */}
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">Backoffice</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Torneios</h1>
        </div>
        <LinkButton href="/admin/tournaments/new" size="md">
          <PlusIcon className="h-4 w-4" />
          Novo torneio
        </LinkButton>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error.message}
        </div>
      )}

      {!tournaments?.length ? (
        <EmptyState />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((t) => {
            const c = counts[t.id] ?? { total: 0, live: 0 };
            return (
              <li key={t.id}>
                <Link
                  href={`/admin/tournaments/${t.id}`}
                  className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 transition hover:border-slate-700 hover:bg-slate-900"
                >
                  {/* Banda de cor primária do torneio */}
                  <div
                    className="absolute inset-x-0 top-0 h-1"
                    style={{ background: t.primary_color ?? "#10b981" }}
                  />

                  <div className="flex items-start gap-4">
                    <div
                      className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-800"
                      style={{ boxShadow: `inset 0 0 0 1px ${t.primary_color ?? "#10b981"}40` }}
                    >
                      {t.logo_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={t.logo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xl font-bold text-slate-400">
                          {t.name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-semibold text-white">{t.name}</h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {new Date(t.created_at).toLocaleDateString("pt-PT", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center gap-4 text-xs text-slate-400">
                    <Stat label="Jogos" value={c.total} />
                    {c.live > 0 && (
                      <Stat label="Ao vivo" value={c.live} accent />
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`text-base font-bold ${accent ? "text-emerald-400" : "text-white"}`}>
        {value}
      </span>
      <span className="text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
      {accent && <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-16 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-800/60 text-slate-500">
        <TrophyIcon className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-white">Sem torneios ainda</h2>
      <p className="mt-1 text-sm text-slate-400">
        Cria o primeiro torneio para começar a registar jogos.
      </p>
      <div className="mt-6">
        <LinkButton href="/admin/tournaments/new">
          <PlusIcon className="h-4 w-4" />
          Criar primeiro torneio
        </LinkButton>
      </div>
    </div>
  );
}
