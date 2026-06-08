"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function ensureOwner(tournamentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("tournaments")
    .select("owner_id")
    .eq("id", tournamentId)
    .single();
  if (!data || data.owner_id !== user.id) redirect("/admin");
  return user;
}

/**
 * Aprovar um pedido de alteração. Opcionalmente com nota + nova hora.
 */
export async function approveRequest(
  tournamentId: string,
  requestId: string,
  formData: FormData,
) {
  const user = await ensureOwner(tournamentId);
  const adminResponse = String(formData.get("admin_response") ?? "").trim();
  const newScheduledAtRaw = String(
    formData.get("admin_new_scheduled_at") ?? "",
  ).trim();

  const newScheduledAt = newScheduledAtRaw
    ? new Date(newScheduledAtRaw).toISOString()
    : null;

  const admin = createAdminClient();
  const { error } = await admin
    .from("match_reschedule_requests")
    .update({
      status: "approved",
      admin_response: adminResponse || null,
      admin_new_scheduled_at: newScheduledAt,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("tournament_id", tournamentId);

  if (error) {
    redirect(
      `/admin/tournaments/${tournamentId}/reschedule-requests?error=` +
        encodeURIComponent(error.message),
    );
  }

  revalidatePath(`/admin/tournaments/${tournamentId}/reschedule-requests`);
  redirect(
    `/admin/tournaments/${tournamentId}/reschedule-requests?ok=` +
      encodeURIComponent("Pedido aprovado"),
  );
}

/**
 * Rejeitar um pedido com motivo.
 */
export async function rejectRequest(
  tournamentId: string,
  requestId: string,
  formData: FormData,
) {
  const user = await ensureOwner(tournamentId);
  const adminResponse = String(formData.get("admin_response") ?? "").trim();

  if (!adminResponse) {
    redirect(
      `/admin/tournaments/${tournamentId}/reschedule-requests?error=` +
        encodeURIComponent("Motivo da rejeição é obrigatório"),
    );
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("match_reschedule_requests")
    .update({
      status: "rejected",
      admin_response: adminResponse,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("tournament_id", tournamentId);

  if (error) {
    redirect(
      `/admin/tournaments/${tournamentId}/reschedule-requests?error=` +
        encodeURIComponent(error.message),
    );
  }

  revalidatePath(`/admin/tournaments/${tournamentId}/reschedule-requests`);
  redirect(
    `/admin/tournaments/${tournamentId}/reschedule-requests?ok=` +
      encodeURIComponent("Pedido rejeitado"),
  );
}

/**
 * Reverter para pending (caso de engano).
 */
export async function revertRequest(
  tournamentId: string,
  requestId: string,
) {
  await ensureOwner(tournamentId);
  const admin = createAdminClient();
  await admin
    .from("match_reschedule_requests")
    .update({
      status: "pending",
      admin_response: null,
      admin_new_scheduled_at: null,
      resolved_by: null,
      resolved_at: null,
    })
    .eq("id", requestId)
    .eq("tournament_id", tournamentId);
  revalidatePath(`/admin/tournaments/${tournamentId}/reschedule-requests`);
}
