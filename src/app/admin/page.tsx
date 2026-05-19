import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PlusIcon, TrophyIcon, UsersIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

const CARD =
  "rounded-2xl bg-white ring-1 ring-slate-200/80 shadow-[0_1px_3px_rgba(16,24,40,0.06),0_1px_2px_rgba(16,24,40,0.04)]";

type MatchRow = {
  id: string;
  tournament_id: string;
  court_name: string;
  team_a_player1: string;
  team_b_player1: string;
  status: "scheduled" | "live" | "finished";
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
        "id, tournament_id, court_name, team_a_player1, team_b_player1, status, created_at",
      )
      .in("tournament_id", tList.map((t) => t.id))
      .order("created_at", { ascending: false });
    matches = (data as MatchRow[]) ?? [];
  }

  const live = matches.filter((m) => m.status === "live");
  const scheduled = matches.filter((m) => m.status === "scheduled");
  const finished = matches.filter((m) => m.status === "finished");
  const recent = matches.slice(0, 6);
  const countByT = new Map<string, number>();
  matches.forEach((m) =>
    countByT.set(m.tournament_id, (countByT.get(m.tournament_id) ?? 0) + 1),
  );

  // Série dos últimos 14 dias (jogos criados por dia)
  const DAYS = 14;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const series = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (DAYS - 1 - i));
    const key = d.toISOString().slice(0, 10);
    const count = matches.filter((m) => m.created_at?.slice(0, 10) === key).length;
    return { key, label: `${d.getDate()}/${d.getMonth() + 1}`, count };
  });

  const firstName =
    ((user?.user_metadata?.name as string | undefined) || user?.email || "")
      .split(/[ @]/)[0] || "admin";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight text-slate-900">
            Olá, {firstName.charAt(0).toUpperCase() + firstName.slice(1)} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Aqui está o resumo dos teus torneios e jogos.
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
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error.message}
        </div>
      )}

      {tList.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Torneios" value={tList.length} tone="violet" icon={<TrophyIcon className="h-5 w-5" />} />
            <Kpi label="Jogos" value={matches.length} tone="sky" icon={<GridIcon className="h-5 w-5" />} />
            <Kpi label="Ao vivo" value={live.length} tone="emerald" icon={<DotIcon className="h-5 w-5" />} highlight={live.length > 0} />
            <Kpi label="Jogadores" value={playersCount ?? 0} tone="amber" icon={<UsersIcon className="h-5 w-5" />} />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {/* Gráfico de atividade */}
            <section className={`${CARD} lg:col-span-2 p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Atividade</h2>
                  <p className="text-xs text-slate-500">Jogos criados — últimos 14 dias</p>
                </div>
                <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                  {matches.length} no total
                </span>
              </div>
              <AreaChart series={series} />
            </section>

            {/* Estado dos jogos + ao vivo */}
            <div className="space-y-5">
              <section className={`${CARD} p-5`}>
                <h2 className="text-sm font-bold text-slate-900">Estado dos jogos</h2>
                <div className="mt-4 space-y-3">
                  <Bar label="Agendados" value={scheduled.length} total={matches.length} color="bg-sky-500" />
                  <Bar label="Ao vivo" value={live.length} total={matches.length} color="bg-emerald-500" />
                  <Bar label="Terminados" value={finished.length} total={matches.length} color="bg-slate-400" />
                </div>
              </section>

              <section className={`${CARD} p-5`}>
                <h2 className="text-sm font-bold text-slate-900">Ao vivo agora</h2>
                {live.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">Nenhum jogo a decorrer.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {live.slice(0, 3).map((m) => (
                      <li key={m.id}>
                        <Link
                          href={`/admin/tournaments/${m.tournament_id}/matches/${m.id}`}
                          className="flex items-center gap-3 rounded-xl bg-emerald-50 px-3 py-2.5 transition hover:bg-emerald-100"
                        >
                          <span className="relative inline-flex h-2.5 w-2.5 shrink-0">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/60" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-bold text-slate-900">{m.court_name}</div>
                            <div className="truncate text-xs text-slate-500">
                              {m.team_a_player1} vs {m.team_b_player1}
                            </div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {/* Tabela jogos recentes */}
            <section className={`${CARD} lg:col-span-2 overflow-hidden`}>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h2 className="text-sm font-bold text-slate-900">Jogos recentes</h2>
              </div>
              {recent.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-slate-500">
                  Sem jogos ainda.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400">
                      <th className="px-5 py-3 font-semibold">Court</th>
                      <th className="px-5 py-3 font-semibold">Jogo</th>
                      <th className="hidden px-5 py-3 font-semibold sm:table-cell">Torneio</th>
                      <th className="px-5 py-3 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((m) => (
                      <tr key={m.id} className="border-t border-slate-100 transition hover:bg-slate-50">
                        <td className="px-5 py-3.5">
                          <Link
                            href={`/admin/tournaments/${m.tournament_id}/matches/${m.id}`}
                            className="font-semibold text-slate-900 hover:text-emerald-600"
                          >
                            {m.court_name}
                          </Link>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">
                          {m.team_a_player1} <span className="text-slate-400">vs</span>{" "}
                          {m.team_b_player1}
                        </td>
                        <td className="hidden px-5 py-3.5 text-slate-500 sm:table-cell">
                          {tMap.get(m.tournament_id)?.name ?? "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusPill status={m.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            {/* Torneios compacto */}
            <section className={`${CARD} p-5`}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">Torneios</h2>
                <Link
                  href="/admin/tournaments/new"
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                >
                  + Novo
                </Link>
              </div>
              <ul className="mt-3 space-y-1">
                {tList.slice(0, 6).map((t) => {
                  const color = t.primary_color ?? "#84cc16";
                  return (
                    <li key={t.id}>
                      <Link
                        href={`/admin/tournaments/${t.id}`}
                        className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition hover:bg-slate-50"
                      >
                        {t.logo_url ? (
                          <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={t.logo_url} alt="" className="h-full w-full object-contain p-0.5" />
                          </span>
                        ) : (
                          <span
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-extrabold text-white"
                            style={{ background: color }}
                          >
                            {t.name.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-slate-900">
                            {t.name}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {countByT.get(t.id) ?? 0} jogos
                          </div>
                        </div>
                        <span className="text-slate-300">›</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
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
  tone,
  highlight,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "violet" | "sky" | "emerald" | "amber";
  highlight?: boolean;
}) {
  const tones: Record<string, string> = {
    violet: "bg-violet-50 text-violet-600",
    sky: "bg-sky-50 text-sky-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <div className={`${CARD} p-5`}>
      <div className="flex items-center justify-between">
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone]}`}>
          {icon}
        </span>
        {highlight && (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            live
          </span>
        )}
      </div>
      <div className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900">
        {value}
      </div>
      <div className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </div>
    </div>
  );
}

function AreaChart({ series }: { series: { label: string; count: number }[] }) {
  const W = 640;
  const H = 170;
  const PAD = 14;
  const max = Math.max(1, ...series.map((s) => s.count));
  const n = series.length;
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / (n - 1);
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const line = series.map((s, i) => `${x(i)},${y(s.count)}`).join(" ");
  const area = `${PAD},${H - PAD} ${line} ${W - PAD},${H - PAD}`;

  return (
    <div className="mt-5">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a3e635" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#a3e635" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => (
          <line
            key={g}
            x1={PAD}
            x2={W - PAD}
            y1={PAD + g * (H - PAD * 2)}
            y2={PAD + g * (H - PAD * 2)}
            stroke="#eef0f4"
            strokeWidth="1"
          />
        ))}
        <polygon points={area} fill="url(#g)" />
        <polyline
          points={line}
          fill="none"
          stroke="#65a30d"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {series.map((s, i) =>
          s.count > 0 ? (
            <circle key={i} cx={x(i)} cy={y(s.count)} r="3" fill="#65a30d" />
          ) : null,
        )}
      </svg>
      <div className="mt-2 flex justify-between px-2 text-[10px] font-medium text-slate-400">
        <span>{series[0]?.label}</span>
        <span>{series[Math.floor(series.length / 2)]?.label}</span>
        <span>{series[series.length - 1]?.label}</span>
      </div>
    </div>
  );
}

function Bar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-600">{label}</span>
        <span className="font-bold text-slate-900">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: "scheduled" | "live" | "finished" }) {
  if (status === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Ao vivo
      </span>
    );
  }
  if (status === "finished") {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
        Terminado
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
      Agendado
    </span>
  );
}

function EmptyState() {
  return (
    <div className={`${CARD} p-16 text-center`}>
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
        <TrophyIcon className="h-7 w-7" />
      </div>
      <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-900">
        Bem-vindo ao GameVision
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
        Cria o teu primeiro torneio para começares a registar jogos e a
        transmitir ao vivo.
      </p>
      <Link
        href="/admin/tournaments/new"
        className="mt-7 inline-flex items-center gap-2 rounded-xl bg-lime-400 px-5 py-3 text-sm font-extrabold text-slate-900 transition hover:bg-lime-300"
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
