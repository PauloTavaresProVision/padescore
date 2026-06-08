import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ConfirmClient } from "./ConfirmClient";

export const dynamic = "force-dynamic";

/**
 * Página PÚBLICA onde um dos outros jogadores envolvidos no match (parceira
 * ou adversário) aceita/rejeita o pedido de alteração de horário.
 *
 * URL: /confirmar/{acceptance_token}
 *
 * O token único identifica a acceptance específica (1 por jogador), não
 * precisa de auth. Cada jogador tem o seu próprio link.
 */
export default async function ConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token || token.length < 10) notFound();

  const supabase = createAdminClient();

  // 1. Acceptance pelo token
  const { data: acceptance } = await supabase
    .from("reschedule_acceptances")
    .select("id, player_name, player_role, player_phone, status, decided_at, request_id")
    .eq("acceptance_token", token)
    .maybeSingle();
  if (!acceptance) notFound();

  // 2. Request (motivo, snapshot, etc)
  const { data: request } = await supabase
    .from("match_reschedule_requests")
    .select(
      "id, requester_name, reason, preferred_slot, game_snapshot, status, tournament_id",
    )
    .eq("id", acceptance.request_id)
    .maybeSingle();
  if (!request) notFound();

  // 3. Tournament para branding
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("name, logo_url, primary_color")
    .eq("id", request.tournament_id)
    .maybeSingle();
  if (!tournament) notFound();

  const primaryColor = tournament.primary_color ?? "#10b981";
  const gameSnapshot = request.game_snapshot as {
    teamA: string;
    teamB: string;
    scheduledAt: string;
    field: string | null;
  };

  return (
    <div
      className="min-h-screen px-3 py-6 sm:px-4 sm:py-10"
      style={{
        background: `linear-gradient(180deg, ${primaryColor}10, #f8fafc)`,
      }}
    >
      <div className="mx-auto max-w-md">
        <header className="mb-6 text-center">
          {tournament.logo_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={tournament.logo_url}
              alt={tournament.name}
              className="mx-auto mb-3 h-16 w-16 rounded-xl object-contain"
            />
          )}
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
            {tournament.name}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Confirmar alteração de horário
          </p>
        </header>

        <ConfirmClient
          token={token}
          playerName={acceptance.player_name}
          playerRole={acceptance.player_role as "partner" | "opponent"}
          status={acceptance.status as "pending" | "accepted" | "rejected"}
          decidedAt={acceptance.decided_at}
          requestStatus={request.status as string}
          requesterName={request.requester_name}
          reason={request.reason}
          preferredSlot={request.preferred_slot}
          gameSnapshot={gameSnapshot}
        />
      </div>
    </div>
  );
}
