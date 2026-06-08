import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChevronLeftIcon } from "@/components/icons";
import { approveRequest, rejectRequest, revertRequest } from "./actions";

export const dynamic = "force-dynamic";

interface GameSnapshot {
  teamA: string;
  teamB: string;
  scheduledAt: string;
  field: string | null;
  category?: string;
}

interface RequestRow {
  id: string;
  padelteams_game_id: number;
  game_snapshot: GameSnapshot;
  requester_name: string;
  requester_phone: string;
  requester_phone_verified: boolean;
  reason: string;
  preferred_slot: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  admin_response: string | null;
  admin_new_scheduled_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

interface AcceptanceRow {
  request_id: string;
  player_name: string;
  player_role: "partner" | "opponent";
  status: "pending" | "accepted" | "rejected";
  decided_at: string | null;
}

export default async function ReschedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
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
    .select("id, name, owner_id, padelteams_competition_code")
    .eq("id", tournamentId)
    .single();
  if (!tournament) notFound();
  if (tournament.owner_id !== user.id) redirect("/admin");

  const { data: requestsRaw } = await supabase
    .from("match_reschedule_requests")
    .select(
      "id, padelteams_game_id, game_snapshot, requester_name, requester_phone, requester_phone_verified, reason, preferred_slot, status, admin_response, admin_new_scheduled_at, resolved_at, created_at",
    )
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: false });
  const requests = (requestsRaw ?? []) as RequestRow[];

  // Buscar acceptances de todos os requests (1 query só)
  const requestIds = requests.map((r) => r.id);
  const { data: acceptancesRaw } =
    requestIds.length > 0
      ? await supabase
          .from("reschedule_acceptances")
          .select("request_id, player_name, player_role, status, decided_at")
          .in("request_id", requestIds)
      : { data: [] };
  const acceptancesByRequest = new Map<string, AcceptanceRow[]>();
  for (const a of (acceptancesRaw ?? []) as AcceptanceRow[]) {
    const arr = acceptancesByRequest.get(a.request_id) ?? [];
    arr.push(a);
    acceptancesByRequest.set(a.request_id, arr);
  }

  const pending = requests.filter((r) => r.status === "pending");
  const resolved = requests.filter((r) => r.status !== "pending");

  const publicUrl = tournament.padelteams_competition_code
    ? `/pedidos/${tournament.padelteams_competition_code}`
    : null;

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
        Pedidos de alteração de horário
      </h1>
      <p className="mt-1 mb-6 max-w-2xl text-sm text-slate-500">
        Pedidos submetidos pelos jogadores via página pública{" "}
        {publicUrl ? (
          <Link
            href={publicUrl}
            target="_blank"
            className="font-semibold text-emerald-600 hover:underline"
          >
            {publicUrl} ↗
          </Link>
        ) : (
          <i>(configura PadelTeams primeiro)</i>
        )}
        . Aprova ou rejeita — o jogador é depois contactado.
      </p>

      {sp.error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {sp.error}
        </div>
      )}
      {sp.ok && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          ✓ {sp.ok.replace(/\+/g, " ")}
        </div>
      )}

      {/* Pendentes */}
      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-900">
          <span className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-full bg-amber-100 px-2 text-xs font-bold text-amber-900">
            {pending.length}
          </span>
          Pendentes
        </h2>
        {pending.length === 0 ? (
          <div className="rounded-xl bg-slate-50 px-5 py-8 text-center text-sm text-slate-500 ring-1 ring-slate-200">
            Sem pedidos pendentes.
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((r) => (
              <RequestCard
                key={r.id}
                tournamentId={tournamentId}
                req={r}
                acceptances={acceptancesByRequest.get(r.id) ?? []}
                isPending
              />
            ))}
          </div>
        )}
      </section>

      {/* Resolvidos */}
      {resolved.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-bold text-slate-900">
            Resolvidos ({resolved.length})
          </h2>
          <div className="space-y-3">
            {resolved.map((r) => (
              <RequestCard
                key={r.id}
                tournamentId={tournamentId}
                req={r}
                acceptances={acceptancesByRequest.get(r.id) ?? []}
                isPending={false}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function RequestCard({
  tournamentId,
  req,
  acceptances,
  isPending,
}: {
  tournamentId: string;
  req: RequestRow;
  acceptances: AcceptanceRow[];
  isPending: boolean;
}) {
  const g = req.game_snapshot;
  const created = new Date(req.created_at);

  return (
    <article
      className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ${
        isPending ? "ring-amber-200" : "ring-slate-200"
      }`}
    >
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-extrabold text-slate-900">
            {g.teamA}{" "}
            <span className="text-xs font-semibold text-emerald-600">VS</span>{" "}
            {g.teamB}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            📅 {formatDateTime(g.scheduledAt)} · 🏟 {g.field ?? "—"}
            {g.category ? ` · ${g.category}` : ""}
          </div>
        </div>
        <StatusBadge status={req.status} />
      </header>

      <div className="mb-3 rounded-lg bg-slate-50 p-3">
        <div className="text-xs font-semibold text-slate-600">
          {req.requester_name}{" "}
          <span className="font-mono text-slate-500">
            ({req.requester_phone})
          </span>
          {req.requester_phone_verified && (
            <span
              className="ml-1 text-emerald-600"
              title="Telemóvel verificado por SMS"
            >
              ✓
            </span>
          )}
          <span className="ml-2 text-slate-400">
            · {formatRelative(created)}
          </span>
        </div>
        <div className="mt-1.5 text-sm text-slate-800">{req.reason}</div>
        {req.preferred_slot && (
          <div className="mt-2 text-xs">
            <span className="font-semibold text-slate-600">
              Sugestão de horário:
            </span>{" "}
            <span className="text-slate-800">{req.preferred_slot}</span>
          </div>
        )}
      </div>

      {acceptances.length > 0 && (
        <div className="mb-3 rounded-lg border border-slate-200 bg-white p-3">
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Confirmação dos outros jogadores
          </div>
          <div className="grid gap-1.5 sm:grid-cols-3">
            {acceptances.map((a, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 rounded-md px-2 py-1.5 text-xs ${
                  a.status === "accepted"
                    ? "bg-emerald-50 text-emerald-900"
                    : a.status === "rejected"
                    ? "bg-red-50 text-red-900"
                    : "bg-slate-50 text-slate-700"
                }`}
              >
                <span className="text-base leading-none">
                  {a.status === "accepted"
                    ? "✓"
                    : a.status === "rejected"
                    ? "✗"
                    : "…"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold leading-tight">{a.player_name}</div>
                  <div className="text-[10px] opacity-70">
                    {a.player_role === "partner" ? "parceira" : "adversário"}
                    {a.decided_at &&
                      ` · ${formatRelative(new Date(a.decided_at))}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {req.admin_response && (
        <div
          className={`mb-3 rounded-lg p-3 text-xs ${
            req.status === "approved"
              ? "bg-emerald-50 text-emerald-900"
              : "bg-red-50 text-red-900"
          }`}
        >
          <div className="font-semibold">Resposta do clube:</div>
          <div className="mt-0.5">{req.admin_response}</div>
          {req.admin_new_scheduled_at && (
            <div className="mt-1">
              <b>Nova hora:</b> {formatDateTime(req.admin_new_scheduled_at)}
            </div>
          )}
        </div>
      )}

      {isPending ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <form
            action={approveRequest.bind(null, tournamentId, req.id)}
            className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3"
          >
            <label className="mb-1.5 block text-xs font-semibold text-emerald-900">
              ✓ Aprovar
            </label>
            <input
              type="datetime-local"
              name="admin_new_scheduled_at"
              className="mb-2 w-full rounded border border-emerald-300 bg-white px-2 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
              title="Nova hora confirmada (opcional)"
            />
            <input
              type="text"
              name="admin_response"
              placeholder="Nota (opcional)"
              className="mb-2 w-full rounded border border-emerald-300 bg-white px-2 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="submit"
              className="w-full rounded bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-600"
            >
              Aprovar pedido
            </button>
          </form>

          <form
            action={rejectRequest.bind(null, tournamentId, req.id)}
            className="rounded-lg border border-red-200 bg-red-50/50 p-3"
          >
            <label className="mb-1.5 block text-xs font-semibold text-red-900">
              ✗ Rejeitar
            </label>
            <input
              type="text"
              name="admin_response"
              required
              placeholder="Motivo (obrigatório)"
              className="mb-2 w-full rounded border border-red-300 bg-white px-2 py-1.5 text-xs focus:border-red-500 focus:outline-none"
            />
            <button
              type="submit"
              className="w-full rounded bg-red-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-600"
            >
              Rejeitar pedido
            </button>
          </form>
        </div>
      ) : (
        <form action={revertRequest.bind(null, tournamentId, req.id)}>
          <button
            type="submit"
            className="text-xs text-slate-400 underline hover:text-slate-600"
            title="Voltar a pôr como pendente (caso de engano)"
          >
            ↶ Reabrir
          </button>
        </form>
      )}
    </article>
  );
}

function StatusBadge({ status }: { status: RequestRow["status"] }) {
  const styles: Record<RequestRow["status"], string> = {
    pending: "bg-amber-100 text-amber-900 border-amber-200",
    approved: "bg-emerald-100 text-emerald-900 border-emerald-200",
    rejected: "bg-red-100 text-red-900 border-red-200",
    cancelled: "bg-slate-100 text-slate-700 border-slate-200",
  };
  const labels: Record<RequestRow["status"], string> = {
    pending: "Pendente",
    approved: "Aprovado",
    rejected: "Rejeitado",
    cancelled: "Cancelado",
  };
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("pt-PT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  const t = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${day} ${t}`;
}

function formatRelative(d: Date): string {
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days} dia${days > 1 ? "s" : ""}`;
}
