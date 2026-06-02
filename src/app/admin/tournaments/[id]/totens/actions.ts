"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function ensureOwner(tournamentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: t } = await supabase
    .from("tournaments")
    .select("owner_id")
    .eq("id", tournamentId)
    .single();
  if (!t || t.owner_id !== user.id) redirect("/admin");
  return supabase;
}

function fail(tournamentId: string, message: string): never {
  redirect(
    `/admin/tournaments/${tournamentId}/totens?error=` +
      encodeURIComponent(message),
  );
}

/** Cria um totem para um campo. Token é gerado automaticamente pelo default
 *  da coluna (function generate_totem_token() — 40 chars). */
export async function createTotem(tournamentId: string, courtId: string) {
  const supabase = await ensureOwner(tournamentId);

  // Pega o nome do campo para sugerir o nome do totem.
  const { data: court } = await supabase
    .from("courts")
    .select("name")
    .eq("id", courtId)
    .eq("tournament_id", tournamentId)
    .single();
  if (!court) fail(tournamentId, "Campo inválido.");

  const { error } = await supabase
    .from("totems")
    .insert({
      tournament_id: tournamentId,
      court_id: courtId,
      name: `Totem ${court.name}`,
      // api_token usa o default do schema
    });
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      fail(tournamentId, `Este campo já tem um totem.`);
    }
    fail(tournamentId, error.message);
  }
  revalidatePath(`/admin/tournaments/${tournamentId}/totens`);
}

/** Gera novo api_token (invalida o anterior). Usar quando suspeitas que
 *  o token foi exposto e queres "fechar" a porta. */
export async function regenerateToken(tournamentId: string, totemId: string) {
  const supabase = await ensureOwner(tournamentId);
  // Chama a function p/ obter token único.
  const { data: newToken, error: tokErr } = await supabase.rpc(
    "generate_totem_token",
  );
  if (tokErr || !newToken) fail(tournamentId, "Falha a gerar novo token.");

  const { error } = await supabase
    .from("totems")
    .update({ api_token: newToken })
    .eq("id", totemId)
    .eq("tournament_id", tournamentId);
  if (error) fail(tournamentId, error.message);
  revalidatePath(`/admin/tournaments/${tournamentId}/totens`);
}

export async function renameTotem(
  tournamentId: string,
  totemId: string,
  formData: FormData,
) {
  const supabase = await ensureOwner(tournamentId);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) fail(tournamentId, "Nome do totem é obrigatório.");
  if (name.length > 60) fail(tournamentId, "Nome demasiado longo.");

  const { error } = await supabase
    .from("totems")
    .update({ name })
    .eq("id", totemId)
    .eq("tournament_id", tournamentId);
  if (error) fail(tournamentId, error.message);
  revalidatePath(`/admin/tournaments/${tournamentId}/totens`);
}

export async function deleteTotem(tournamentId: string, totemId: string) {
  const supabase = await ensureOwner(tournamentId);
  const { error } = await supabase
    .from("totems")
    .delete()
    .eq("id", totemId)
    .eq("tournament_id", tournamentId);
  if (error) fail(tournamentId, error.message);
  revalidatePath(`/admin/tournaments/${tournamentId}/totens`);
}
