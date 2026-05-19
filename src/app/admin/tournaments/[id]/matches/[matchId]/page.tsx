import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Scoreboard } from "@/components/Scoreboard";
import { CopyButton } from "@/components/CopyButton";
import { AdminControls } from "./AdminControls";
import { setTvMatch, clearTvMatch } from "./actions";
import { resolveStartedAt } from "@/lib/scoring/started-at";
import { configFromMatch } from "@/lib/scoring/apply";
import {
  BroadcastIcon,
  ChevronLeftIcon,
  ExternalLinkIcon,
  MobileIcon,
  MonitorIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string; matchId: string }>;
}) {
  const { id: tournamentId, matchId } = await params;
  const supabase = await createClient();

  const [{ data: match }, { data: tournament }, { data: state }] = await Promise.all([
    supabase.from("matches").select("*").eq("id", matchId).single(),
    supabase.from("tournaments").select("*").eq("id", tournamentId).single(),
    supabase.from("match_state").select("*").eq("match_id", matchId).single(),
  ]);

  if (!match || !tournament) notFound();

  match.started_at = await resolveStartedAt(supabase, match.id, match.started_at);

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const baseUrl = `${proto}://${host}`;
  // Usa o novo short_code do operador (8 chars). Fallback ao token longo
  // para matches criados antes da migration 0009.
  const operatorCode = match.operator_short_code ?? match.operator_token;
  const operatorUrl = `${baseUrl}/score/${operatorCode}`;
  const overlayUrl = `${baseUrl}/obs/${match.short_code}`;
  const scoreboardUrl = `${baseUrl}/tv/${match.short_code}`;
  // Canal de TV do torneio (link fixo; troca-se o jogo à distância).
  const tvLiveUrl = tournament.tv_code
    ? `${baseUrl}/tv/live/${tournament.tv_code}`
    : null;
  const isOnTv = tournament.tv_active_match_id === match.id;

  const safeState = state ?? {
    points_a: "0",
    points_b: "0",
    games_a: 0,
    games_b: 0,
    sets_a: 0,
    sets_b: 0,
    sets_history: [],
    server: "A" as const,
    in_tiebreak: false,
    in_super_tiebreak: false,
    is_finished: false,
    winner: null,
  };

  const teamA = [match.team_a_player1, match.team_a_player2].filter(Boolean).join(" / ");
  const teamB = [match.team_b_player1, match.team_b_player2].filter(Boolean).join(" / ");

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <Link
          href={`/admin/tournaments/${tournamentId}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-900"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          {tournament.name}
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{match.court_name}</h1>
            <span className="text-sm text-slate-500">
              {teamA} <span className="text-slate-400">vs</span> {teamB}
            </span>
            <StatusBadge status={match.status} />
            {match.short_code && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 font-mono text-xs uppercase tracking-widest text-slate-700">
                <span className="text-slate-400">#</span>
                {match.short_code}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <TvCastButton
              tournamentId={tournamentId}
              matchId={matchId}
              isOnTv={isOnTv}
            />
            <Link
              href={`/admin/tournaments/${tournamentId}/matches/${matchId}/edit`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                <path d="m15 5 4 4" />
              </svg>
              Editar jogo
            </Link>
          </div>
        </div>
      </div>

      {/* Hero scoreboard */}
      <section>
        <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-950 p-8">
          <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-widest text-slate-500">
            <span>Marcador ao vivo</span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Realtime
            </span>
          </div>
          <div className="flex items-center justify-center py-2">
            <Scoreboard
              match={match}
              tournament={tournament}
              config={configFromMatch(match)}
              initialState={safeState}
            />
          </div>
        </div>
      </section>

      {/* Controlos */}
      <section>
        <SectionHeader title="Controlos" hint="Regista pontos do PC sem usar o telemóvel." />
        <AdminControls
          tournamentId={tournamentId}
          matchId={matchId}
          teamAName={teamA}
          teamBName={teamB}
          isFinished={safeState.is_finished}
        />
      </section>

      {/* Links */}
      <section>
        <SectionHeader title="Links" hint="Partilha estes URLs com o operador, OBS e telões." />
        <div className="grid gap-3 md:grid-cols-3">
          <LinkCard
            icon={<MobileIcon className="h-5 w-5" />}
            title="Marcador do operador"
            description="Abre no telemóvel para registar pontos."
            url={operatorUrl}
            accent="emerald"
          />
          <LinkCard
            icon={<BroadcastIcon className="h-5 w-5" />}
            title="Overlay OBS"
            description="Browser Source · canto superior esquerdo · fundo transparente."
            url={overlayUrl}
            accent="cyan"
          />
          <LinkCard
            icon={<MonitorIcon className="h-5 w-5" />}
            title="Scoreboard (este jogo)"
            description="URL fixo só deste jogo."
            url={scoreboardUrl}
            accent="violet"
          />
        </div>

        {tvLiveUrl && (
          <div className="mt-3">
            <LinkCard
              icon={<MonitorIcon className="h-5 w-5" />}
              title="Canal de TV do torneio (recomendado)"
              description="Abre ISTO na TV uma vez, fullscreen. Carrega em &quot;Pôr na TV&quot; (topo) em cada jogo — a TV troca sozinha, sem ninguém ir lá."
              url={tvLiveUrl}
              accent="cyan"
            />
          </div>
        )}
      </section>

      {/* Configuração */}
      <section>
        <SectionHeader title="Configuração" />
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/80 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
          <dl className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 md:grid-cols-3">
            <ConfigItem label="Sistema" value={match.golden_point ? "Golden point" : "Vantagens"} />
            <ConfigItem label="Sets para ganhar" value={String(match.sets_to_win)} />
            <ConfigItem label="Games por set" value={String(match.games_per_set)} />
            <ConfigItem label="Tiebreak em" value={`${match.tiebreak_at}-${match.tiebreak_at}`} />
            <ConfigItem label="Pontos do tiebreak" value={String(match.tiebreak_points)} />
            <ConfigItem
              label="Super tiebreak final"
              value={match.final_set_super_tiebreak ? "Sim (a 10)" : "Não"}
            />
          </dl>
        </div>
      </section>
    </div>
  );
}

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function TvCastButton({
  tournamentId,
  matchId,
  isOnTv,
}: {
  tournamentId: string;
  matchId: string;
  isOnTv: boolean;
}) {
  if (isOnTv) {
    return (
      <form action={clearTvMatch.bind(null, tournamentId, matchId)}>
        <button
          type="submit"
          title="Tirar este jogo da TV (volta ao ecrã de espera)"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
        >
          <span className="relative inline-block h-2 w-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60" />
            <span className="absolute inset-0 rounded-full bg-emerald-400" />
          </span>
          No ar — tirar da TV
        </button>
      </form>
    );
  }
  return (
    <form action={setTvMatch.bind(null, tournamentId, matchId)}>
      <button
        type="submit"
        title="Pôr este jogo no canal de TV do torneio"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-cyan-300 bg-cyan-50 px-3.5 py-2 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <rect width="20" height="14" x="2" y="3" rx="2" />
          <line x1="8" x2="16" y1="21" y2="21" />
          <line x1="12" x2="12" y1="17" y2="21" />
        </svg>
        Pôr na TV
      </button>
    </form>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map = {
    live: { label: "AO VIVO", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
    scheduled: { label: "AGENDADO", className: "bg-sky-50 text-sky-700 ring-sky-200" },
    finished: { label: "TERMINADO", className: "bg-slate-100 text-slate-500 ring-slate-200" },
  } as const;
  const s = map[status as keyof typeof map] ?? map.scheduled;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ring-1 ${s.className}`}
    >
      {status === "live" && (
        <span className="relative inline-block h-1.5 w-1.5">
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60" />
          <span className="absolute inset-0 rounded-full bg-emerald-400" />
        </span>
      )}
      {s.label}
    </span>
  );
}

function LinkCard({
  icon,
  title,
  description,
  url,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  url: string;
  accent: "emerald" | "cyan" | "violet";
}) {
  const accents = {
    emerald: "bg-emerald-50 text-emerald-600",
    cyan: "bg-cyan-50 text-cyan-600",
    violet: "bg-violet-50 text-violet-600",
  }[accent];

  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/80 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
      <div className="flex items-center gap-3 border-b border-slate-100 p-4">
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${accents}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-900">{title}</div>
          <div className="text-xs text-slate-500">{description}</div>
        </div>
      </div>
      <div className="space-y-2 p-4">
        <code className="block break-all rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 font-mono text-[11px] text-slate-600">
          {url}
        </code>
        <div className="flex gap-2">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            <ExternalLinkIcon className="h-3.5 w-3.5" />
            Abrir
          </a>
          <CopyButton text={url} />
        </div>
      </div>
    </div>
  );
}

function ConfigItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-4">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-bold text-slate-900">{value}</dd>
    </div>
  );
}
