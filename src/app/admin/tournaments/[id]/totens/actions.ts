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

/**
 * Cria um cavalete novo (1 ou 2 campos). O token é gerado automaticamente
 * pelo default do schema (16 chars opacos).
 */
export async function createCavalete(
  tournamentId: string,
  formData: FormData,
) {
  const supabase = await ensureOwner(tournamentId);
  const courtId1 = String(formData.get("court_id_1") ?? "");
  const courtId2Raw = String(formData.get("court_id_2") ?? "");
  const courtId2 = courtId2Raw && courtId2Raw !== courtId1 ? courtId2Raw : null;
  const customName = String(formData.get("name") ?? "").trim();

  if (!courtId1) fail(tournamentId, "Escolhe pelo menos 1 campo.");
  if (courtId2 === courtId1) {
    fail(tournamentId, "Os 2 campos do cavalete têm que ser diferentes.");
  }

  // Validar que os campos existem e pertencem a este torneio
  const allCourtIds = [courtId1, ...(courtId2 ? [courtId2] : [])];
  const { data: courts } = await supabase
    .from("courts")
    .select("id, name")
    .in("id", allCourtIds)
    .eq("tournament_id", tournamentId);
  if (!courts || courts.length !== allCourtIds.length) {
    fail(tournamentId, "Campo inválido.");
  }

  // Verificar que nenhum dos campos já está noutro cavalete
  const { data: usedBy } = await supabase
    .from("totems")
    .select("court_id, court_id_2, name")
    .eq("tournament_id", tournamentId);
  const usedIds = new Set<string>();
  for (const t of usedBy ?? []) {
    if (t.court_id) usedIds.add(t.court_id);
    if (t.court_id_2) usedIds.add(t.court_id_2);
  }
  const conflicts = allCourtIds.filter((id) => usedIds.has(id));
  if (conflicts.length > 0) {
    const names = courts!
      .filter((c) => conflicts.includes(c.id))
      .map((c) => c.name)
      .join(", ");
    fail(
      tournamentId,
      `Campo(s) já noutro cavalete: ${names}. Apaga primeiro o cavalete que os usa.`,
    );
  }

  // Nome sugerido: "Cavalete CAMPO1 + CAMPO2"
  const name = customName ||
    (courtId2
      ? `Cavalete ${courts!.find((c) => c.id === courtId1)!.name} + ${courts!.find((c) => c.id === courtId2)!.name}`
      : `Totem ${courts![0].name}`);

  const { error } = await supabase.from("totems").insert({
    tournament_id: tournamentId,
    court_id: courtId1,
    court_id_2: courtId2,
    name,
  });
  if (error) fail(tournamentId, error.message);
  revalidatePath(`/admin/tournaments/${tournamentId}/totens`);
}

/** Actualiza os campos de um cavalete (1 ou 2). */
export async function setCavaleteCourts(
  tournamentId: string,
  totemId: string,
  courtId1: string,
  courtId2: string | null,
) {
  const supabase = await ensureOwner(tournamentId);

  if (courtId2 === courtId1) courtId2 = null;

  const { error } = await supabase
    .from("totems")
    .update({ court_id: courtId1, court_id_2: courtId2 })
    .eq("id", totemId)
    .eq("tournament_id", tournamentId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/tournaments/${tournamentId}/totens`);
}

export async function regenerateToken(tournamentId: string, totemId: string) {
  const supabase = await ensureOwner(tournamentId);
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
  if (!name) fail(tournamentId, "Nome é obrigatório.");
  if (name.length > 80) fail(tournamentId, "Nome demasiado longo.");

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

// Backwards compat — alguns componentes ainda chamam createTotem(courtId)
export async function createTotem(tournamentId: string, courtId: string) {
  const supabase = await ensureOwner(tournamentId);
  const { data: court } = await supabase
    .from("courts")
    .select("name")
    .eq("id", courtId)
    .eq("tournament_id", tournamentId)
    .single();
  if (!court) fail(tournamentId, "Campo inválido.");

  const { error } = await supabase.from("totems").insert({
    tournament_id: tournamentId,
    court_id: courtId,
    name: `Totem ${court.name}`,
  });
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      fail(tournamentId, "Este campo já tem um totem.");
    }
    fail(tournamentId, error.message);
  }
  revalidatePath(`/admin/tournaments/${tournamentId}/totens`);
}
