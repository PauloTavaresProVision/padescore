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
    .select("id, name, logo_url, primary_color, tv_background_url, created_at")
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
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-lime-400">
            Backoffice
          </p>
          <h1 className="mt-2 text-[42px] font-extrabold leading-none tracking-tight">
            Torneios
          </h1>
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
          className="inline-flex items-center gap-2 rounded-xl bg-lime-400 px-5 py-3 text-sm font-extrabold text-slate-950 shadow-lg shadow-lime-400/25 transition hover:-translate-y-0.5 hover:bg-lime-300 hover:shadow-lime-400/40"
        >
          <PlusIcon className="h-4 w-4" strokeWidth={2.6} />
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
        <div className="mt-9 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((t) => (
            <PosterCard
              key={t.id}
              t={t}
              c={counts[t.id] ?? { total: 0, live: 0 }}
            />
          ))}
          <Link
            href="/admin/tournaments/new"
            className="group flex aspect-[16/11] flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-white/[0.14] bg-white/[0.015] text-slate-500 transition hover:border-lime-400/50 hover:bg-lime-400/[0.05] hover:text-lime-300"
          >
            <span className="grid h-16 w-16 place-items-center rounded-2xl border border-current">
              <PlusIcon className="h-7 w-7" strokeWidth={2.4} />
            </span>
            <span className="text-sm font-bold uppercase tracking-wider">
              Criar torneio
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}

function PosterCard({
  t,
  c,
}: {
  t: {
    id: string;
    name: string;
    logo_url: string | null;
    primary_color: string | null;
    tv_background_url: string | null;
    created_at: string;
  };
  c: { total: number; live: number };
}) {
  const color = t.primary_color ?? "#a3e635";
  const date = new Date(t.created_at).toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Link
      href={`/admin/tournaments/${t.id}`}
      className="group relative flex aspect-[16/11] flex-col justify-end overflow-hidden rounded-3xl border border-white/[0.07] transition duration-300 hover:-translate-y-1.5 hover:border-white/20 hover:shadow-[0_28px_60px_-15px_rgba(0,0,0,0.8)]"
    >
      {/* Fundo: imagem do torneio, ou gradiente rico da cor primária */}
      {t.tv_background_url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={t.tv_background_url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-[600ms] group-hover:scale-[1.07]"
        />
      ) : (
        <div
          className="absolute inset-0 transition-transform duration-[600ms] group-hover:scale-[1.07]"
          style={{
            background: `radial-gradient(120% 120% at 18% 12%, ${color}, ${color}22 45%, #0a0c12 78%)`,
          }}
        />
      )}

      {/* Scrim para legibilidade + brilho da cor no topo */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#06070c] via-[#06070c]/55 to-transparent" />
      <div
        className="absolute inset-x-0 top-0 h-24 opacity-60"
        style={{
          background: `linear-gradient(180deg, ${color}40, transparent)`,
        }}
      />
      <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: color }} />

      {/* Live badge */}
      {c.live > 0 && (
        <div className="absolute right-4 top-4 flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 backdrop-blur-sm">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-white">
            Ao vivo
          </span>
        </div>
      )}

      {/* Conteúdo sobreposto em baixo */}
      <div className="relative z-10 p-5">
        <div className="flex items-end gap-3.5">
          {t.logo_url ? (
            <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white shadow-lg shadow-black/50 ring-1 ring-white/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.logo_url} alt="" className="h-full w-full object-contain p-1.5" />
            </span>
          ) : (
            <span
              className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-xl font-extrabold text-white ring-1 ring-white/20"
              style={{ background: `linear-gradient(135deg, ${color}, ${color}55)` }}
            >
              {t.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1 pb-0.5">
            <h3
              className="truncate text-xl font-extrabold tracking-tight text-white"
              style={{ textShadow: "0 2px 12px rgba(0,0,0,0.7)" }}
            >
              {t.name}
            </h3>
            <p className="mt-0.5 text-xs font-semibold text-slate-300/80">{date}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-5 border-t border-white/15 pt-3.5">
          <span className="flex items-center gap-2 text-sm text-white">
            <CourtIcon className="h-4 w-4 text-white/60" />
            <b className="font-extrabold">{c.total}</b>
            <span className="text-xs font-medium text-white/60">
              {c.total === 1 ? "jogo" : "jogos"}
            </span>
          </span>
          {c.live > 0 && (
            <span className="flex items-center gap-2 text-sm">
              <span className="h-2 w-2 rounded-full bg-lime-400 shadow-[0_0_8px_#a3e635]" />
              <b className="font-extrabold text-lime-400">{c.live}</b>
              <span className="text-xs font-semibold text-lime-400/80">ao vivo</span>
            </span>
          )}
          <span className="ml-auto text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white">
            <ArrowIcon className="h-5 w-5" />
          </span>
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
    <span className="inline-flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-2 text-sm">
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
    <div className="mt-9 overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.015] p-16 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-lime-400/[0.14] text-lime-400">
        <TrophyIcon className="h-7 w-7" />
      </div>
      <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-white">
        Ainda sem torneios
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

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
