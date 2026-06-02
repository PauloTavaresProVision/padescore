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
    `/admin/tournaments/${tournamentId}?error=` +
      encodeURIComponent(message),
  );
}

export async function createCourt(tournamentId: string, formData: FormData) {
  const supabase = await ensureOwner(tournamentId);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) fail(tournamentId, "Nome do campo é obrigatório.");
  if (name.length > 60) fail(tournamentId, "Nome do campo demasiado longo.");

  // sort_order = max actual + 1 (no fim da lista)
  const { data: last } = await supabase
    .from("courts")
    .select("sort_order")
    .eq("tournament_id", tournamentId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const next = (last?.sort_order ?? -1) + 1;

  const { error } = await supabase
    .from("courts")
    .insert({ tournament_id: tournamentId, name, sort_order: next });
  if (error) {
    // 23505 = unique violation (já existe um campo com este nome)
    if ((error as { code?: string }).code === "23505") {
      fail(tournamentId, `Já existe um campo chamado "${name}".`);
    }
    fail(tournamentId, error.message);
  }
  revalidatePath(`/admin/tournaments/${tournamentId}`);
}

export async function renameCourt(
  tournamentId: string,
  courtId: string,
  formData: FormData,
) {
  const supabase = await ensureOwner(tournamentId);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) fail(tournamentId, "Nome do campo é obrigatório.");
  if (name.length > 60) fail(tournamentId, "Nome do campo demasiado longo.");

  const { error } = await supabase
    .from("courts")
    .update({ name })
    .eq("id", courtId)
    .eq("tournament_id", tournamentId);
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      fail(tournamentId, `Já existe um campo chamado "${name}".`);
    }
    fail(tournamentId, error.message);
  }
  // Snapshot opcional: sincronizar matches.court_name para o novo nome.
  // (Decisão de design: NÃO sincronizar — court_name é histórico, mantém
  // o nome com que o jogo foi criado. Se quiseres sincronizar, descomenta.)
  // await supabase.from("matches").update({ court_name: name }).eq("court_id", courtId);
  revalidatePath(`/admin/tournaments/${tournamentId}`);
}

export async function deleteCourt(tournamentId: string, courtId: string) {
  const supabase = await ensureOwner(tournamentId);

  // Segurança: não apagar se há matches associados (evita perder a ligação).
  const { count } = await supabase
    .from("matches")
    .select("*", { count: "exact", head: true })
    .eq("court_id", courtId);
  if ((count ?? 0) > 0) {
    fail(
      tournamentId,
      `Não dá para apagar este campo — tem ${count} jogo(s) associado(s). Move-os para outro campo primeiro.`,
    );
  }

  const { error } = await supabase
    .from("courts")
    .delete()
    .eq("id", courtId)
    .eq("tournament_id", tournamentId);
  if (error) fail(tournamentId, error.message);
  revalidatePath(`/admin/tournaments/${tournamentId}`);
}

export async function reorderCourts(
  tournamentId: string,
  orderedIds: string[],
) {
  const supabase = await ensureOwner(tournamentId);
  // Update individual de sort_order por id, em sequência. Pequeno volume
  // (poucos campos por torneio) — não compensa upsert batch.
  for (let i = 0; i < orderedIds.length; i++) {
    await supabase
      .from("courts")
      .update({ sort_order: i })
      .eq("id", orderedIds[i])
      .eq("tournament_id", tournamentId);
  }
  revalidatePath(`/admin/tournaments/${tournamentId}`);
}
