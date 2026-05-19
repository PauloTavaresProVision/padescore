import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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

  const totalGames = Object.values(counts).reduce((s, c) => s + c.total, 0);
  const totalLive = Object.values(counts).reduce((s, c) => s + c.live, 0);
  const list = tournaments ?? [];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-lime-400">
            Backoffice
          </p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight">Torneios</h1>
          {list.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2.5">
              <StatChip value={list.length} label={list.length === 1 ? "torneio" : "torneios"} />
              <StatChip value={totalGames} label={totalGames === 1 ? "jogo" : "jogos"} />
              <StatChip value={totalLive} label="ao vivo" live />
            </div>
          )}
        </div>
        <Link
          href="/admin/tournaments/new"
          className="inline-flex items-center gap-2 rounded-xl bg-lime-400 px-5 py-3 text-sm font-extrabold text-slate-950 shadow-lg shadow-lime-400/20 transition hover:-translate-y-0.5 hover:bg-lime-300 hover:shadow-lime-400/30"
        >
          <PlusIcon className="h-4 w-4" strokeWidth={2.5} />
          Novo torneio
        </Link>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error.message}
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((t) => (
            <TournamentCard
              key={t.id}
              t={t}
              c={counts[t.id] ?? { total: 0, live: 0 }}
            />
          ))}
          <Link
            href="/admin/tournaments/new"
            className="group flex min-h-[210px] flex-col items-center justify-center gap-3.5 rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.01] text-slate-500 transition hover:border-lime-400/50 hover:bg-lime-400/[0.05] hover:text-lime-300"
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

function TournamentCard({
  t,
  c,
}: {
  t: {
    id: string;
    name: string;
    logo_url: string | null;
    primary_color: string | null;
    created_at: string;
  };
  c: { total: number; live: number };
}) {
  const color = t.primary_color ?? "#a3e635";
  return (
    <Link
      href={`/admin/tournaments/${t.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] transition duration-200 hover:-translate-y-1 hover:border-lime-400/30 hover:bg-white/[0.04] hover:shadow-2xl hover:shadow-black/50"
    >
      {/* faixa da cor do torneio */}
      <div className="h-[3px] w-full" style={{ background: color }} />

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start gap-3.5">
          {t.logo_url ? (
            <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-white shadow-md shadow-black/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.logo_url} alt="" className="h-full w-full object-contain p-1" />
            </span>
          ) : (
            <span
              className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-lg font-extrabold text-white"
              style={{ background: `linear-gradient(135deg, ${color}, ${color}33)` }}
            >
              {t.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="truncate text-[15px] font-bold tracking-tight text-white">
              {t.name}
            </h3>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {new Date(t.created_at).toLocaleDateString("pt-PT", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        <div className="mt-auto flex items-center gap-5 border-t border-white/[0.06] pt-4">
          <span className="flex items-center gap-2 text-sm">
            <CourtIcon className="h-4 w-4 text-slate-500" />
            <b className="font-extrabold text-white">{c.total}</b>
            <span className="text-xs font-medium text-slate-500">
              {c.total === 1 ? "jogo" : "jogos"}
            </span>
          </span>
          {c.live > 0 && (
            <span className="flex items-center gap-2 text-sm">
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-400/70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-lime-400" />
              </span>
              <b className="font-extrabold text-lime-400">{c.live}</b>
              <span className="text-xs font-semibold text-lime-400/80">ao vivo</span>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function StatChip({
  value,
  label,
  live,
}: {
  value: number;
  label: string;
  live?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2 text-sm">
      {live && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            value > 0 ? "bg-lime-400 shadow-[0_0_8px_#a3e635]" : "bg-slate-600"
          }`}
        />
      )}
      <b className="font-extrabold text-white">{value}</b>
      <span className="font-medium text-slate-500">{label}</span>
    </span>
  );
}

function EmptyState() {
  return (
    <div className="mt-9 rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.01] p-16 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-lime-400/[0.12] text-lime-400">
        <TrophyIcon className="h-7 w-7" />
      </div>
      <h2 className="mt-5 text-xl font-bold text-white">Ainda sem torneios</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-400">
        Cria o teu primeiro torneio para começares a registar jogos e a
        transmitir.
      </p>
      <Link
        href="/admin/tournaments/new"
        className="mt-7 inline-flex items-center gap-2 rounded-xl bg-lime-400 px-5 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-lime-300"
      >
        <PlusIcon className="h-4 w-4" strokeWidth={2.5} />
        Criar primeiro torneio
      </Link>
    </div>
  );
}

function CourtIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="M12 5v14M3 12h4M17 12h4" />
    </svg>
  );
}
