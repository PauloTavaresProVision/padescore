import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PlusIcon, TrophyIcon, UsersIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

type MatchRow = {
  id: string;
  tournament_id: string;
  court_name: string;
  team_a_player1: string;
  team_a_player2: string | null;
  team_b_player1: string;
  team_b_player2: string | null;
  status: "scheduled" | "live" | "finished";
  started_at: string | null;
  created_at: string;
};

export default async function AdminDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: tournaments, error }, { count: playersCount }] = await Promise.all([
    supabase
      .from("tournaments")
      .select("id, name, logo_url, primary_color, created_at")
      .eq("owner_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase.from("players").select("id", { count: "exact", head: true }),
  ]);

  const tList = tournaments ?? [];
  const tMap = new Map(tList.map((t) => [t.id, t]));

  let matches: MatchRow[] = [];
  if (tList.length) {
    const { data } = await supabase
      .from("matches")
      .select(
        "id, tournament_id, court_name, team_a_player1, team_a_player2, team_b_player1, team_b_player2, status, started_at, created_at",
      )
      .in("tournament_id", tList.map((t) => t.id))
      .order("created_at", { ascending: false });
    matches = (data as MatchRow[]) ?? [];
  }

  const totalGames = matches.length;
  const liveMatches = matches.filter((m) => m.status === "live");
  const recent = matches.slice(0, 6);
  const countByT = new Map<string, number>();
  matches.forEach((m) =>
    countByT.set(m.tournament_id, (countByT.get(m.tournament_id) ?? 0) + 1),
  );

  const firstName =
    ((user?.user_metadata?.name as string | undefined) ||
      user?.email ||
      "")
      .split(/[ @]/)[0] || "admin";

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-lime-400">
            Backoffice
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
            Olá, {firstName.charAt(0).toUpperCase() + firstName.slice(1)}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Visão geral dos teus torneios e jogos.
          </p>
        </div>
        <Link
          href="/admin/tournaments/new"
          className="inline-flex items-center gap-2 rounded-xl bg-lime-400 px-5 py-3 text-sm font-extrabold text-slate-950 shadow-lg shadow-lime-400/25 transition hover:-translate-y-0.5 hover:bg-lime-300"
        >
          <PlusIcon className="h-4 w-4" strokeWidth={2.6} />
          Novo torneio
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error.message}
        </div>
      )}

      {tList.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Torneios" value={tList.length} icon={<TrophyIcon className="h-5 w-5" />} />
            <Kpi label="Jogos" value={totalGames} icon={<GridIcon className="h-5 w-5" />} />
            <Kpi
              label="Ao vivo"
              value={liveMatches.length}
              icon={<DotIcon className="h-5 w-5" />}
              accent={liveMatches.length > 0}
            />
            <Kpi label="Jogadores" value={playersCount ?? 0} icon={<UsersIcon className="h-5 w-5" />} />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {/* Jogos recentes — tabela */}
            <section className="lg:col-span-2 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                  Jogos recentes
                </h2>
                {liveMatches.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-lime-400">
                    <span className="relative inline-flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-400/70" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-lime-400" />
                    </span>
                    {liveMatches.length} ao vivo
                  </span>
                )}
              </div>
              {recent.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-slate-500">
                  Sem jogos ainda. Cria um jogo num torneio para aparecer aqui.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="px-5 py-3 font-semibold">Court</th>
                      <th className="px-5 py-3 font-semibold">Jogo</th>
                      <th className="hidden px-5 py-3 font-semibold sm:table-cell">Torneio</th>
                      <th className="px-5 py-3 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((m) => {
                      const tt = tMap.get(m.tournament_id);
                      const a = [m.team_a_player1, m.team_a_player2].filter(Boolean).join(" / ");
                      const b = [m.team_b_player1, m.team_b_player2].filter(Boolean).join(" / ");
                      return (
                        <tr
                          key={m.id}
                          className="border-t border-white/[0.05] transition hover:bg-white/[0.03]"
                        >
                          <td className="px-5 py-3.5">
                            <Link
                              href={`/admin/tournaments/${m.tournament_id}/matches/${m.id}`}
                              className="font-semibold text-white hover:text-lime-400"
                            >
                              {m.court_name}
                            </Link>
                          </td>
                          <td className="px-5 py-3.5 text-slate-300">
                            <span className="truncate">{a}</span>
                            <span className="px-1.5 text-slate-600">vs</span>
                            <span className="truncate">{b}</span>
                          </td>
                          <td className="hidden px-5 py-3.5 text-slate-500 sm:table-cell">
                            {tt?.name ?? "—"}
                          </td>
                          <td className="px-5 py-3.5">
                            <StatusPill status={m.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>

            {/* Rail direito: ao vivo + torneios */}
            <div className="space-y-5">
              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                  Ao vivo agora
                </h2>
                {liveMatches.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">
                    Nenhum jogo a decorrer.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {liveMatches.slice(0, 4).map((m) => (
                      <li key={m.id}>
                        <Link
                          href={`/admin/tournaments/${m.tournament_id}/matches/${m.id}`}
                          className="flex items-center gap-3 rounded-xl border border-lime-400/20 bg-lime-400/[0.06] px-3.5 py-3 transition hover:bg-lime-400/[0.12]"
                        >
                          <span className="relative inline-flex h-2.5 w-2.5 shrink-0">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-400/70" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-lime-400" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-bold text-white">
                              {m.court_name}
                            </div>
                            <div className="truncate text-xs text-slate-400">
                              {m.team_a_player1} vs {m.team_b_player1}
                            </div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                    Torneios
                  </h2>
                  <Link
                    href="/admin/tournaments/new"
                    className="text-xs font-bold text-lime-400 hover:text-lime-300"
                  >
                    + Novo
                  </Link>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {tList.slice(0, 6).map((t) => {
                    const color = t.primary_color ?? "#a3e635";
                    return (
                      <li key={t.id}>
                        <Link
                          href={`/admin/tournaments/${t.id}`}
                          className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition hover:bg-white/[0.04]"
                        >
                          {t.logo_url ? (
                            <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-white">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={t.logo_url} alt="" className="h-full w-full object-contain p-0.5" />
                            </span>
                          ) : (
                            <span
                              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-extrabold text-white"
                              style={{ background: `linear-gradient(135deg, ${color}, ${color}55)` }}
                            >
                              {t.name.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-white">
                              {t.name}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {countByT.get(t.id) ?? 0} jogos
                            </div>
                          </div>
                          <span className="text-slate-600">›</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
      <div className="flex items-center justify-between">
        <span
          className={[
            "grid h-10 w-10 place-items-center rounded-xl",
            accent ? "bg-lime-400/15 text-lime-400" : "bg-white/[0.05] text-slate-400",
          ].join(" ")}
        >
          {icon}
        </span>
        {accent && value > 0 && (
          <span className="h-2 w-2 rounded-full bg-lime-400 shadow-[0_0_8px_#a3e635]" />
        )}
      </div>
      <div
        className={[
          "mt-4 text-3xl font-extrabold tracking-tight",
          accent && value > 0 ? "text-lime-400" : "text-white",
        ].join(" ")}
      >
        {value}
      </div>
      <div className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: "scheduled" | "live" | "finished" }) {
  if (status === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-lime-400/15 px-2.5 py-1 text-xs font-bold text-lime-400">
        <span className="h-1.5 w-1.5 rounded-full bg-lime-400" />
        Ao vivo
      </span>
    );
  }
  if (status === "finished") {
    return (
      <span className="inline-flex rounded-full bg-white/[0.05] px-2.5 py-1 text-xs font-semibold text-slate-400">
        Terminado
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-sky-400/10 px-2.5 py-1 text-xs font-semibold text-sky-300">
      Agendado
    </span>
  );
}

function EmptyState() {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.015] p-16 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-lime-400/[0.14] text-lime-400">
        <TrophyIcon className="h-7 w-7" />
      </div>
      <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-white">
        Bem-vindo ao GameVision
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-slate-400">
        Cria o teu primeiro torneio para começares a registar jogos e a
        transmitir ao vivo.
      </p>
      <Link
        href="/admin/tournaments/new"
        className="mt-7 inline-flex items-center gap-2 rounded-xl bg-lime-400 px-5 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-lime-300"
      >
        <PlusIcon className="h-4 w-4" strokeWidth={2.6} />
        Criar primeiro torneio
      </Link>
    </div>
  );
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="M12 5v14M3 12h4M17 12h4" />
    </svg>
  );
}

function DotIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}
