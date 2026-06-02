"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type SponsorKind = "footer" | "fullscreen";
const KINDS: SponsorKind[] = ["footer", "fullscreen"];

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
  return { supabase, userId: user.id };
}

function fail(tournamentId: string, message: string): never {
  redirect(
    `/admin/tournaments/${tournamentId}/sponsors?error=` +
      encodeURIComponent(message),
  );
}

export async function uploadSponsor(
  tournamentId: string,
  formData: FormData,
) {
  const { supabase, userId } = await ensureOwner(tournamentId);

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) fail(tournamentId, "Escolhe uma imagem.");
  if (file.size > 8 * 1024 * 1024) {
    fail(tournamentId, "Imagem demasiado grande (máx 8 MB).");
  }
  if (!file.type.startsWith("image/")) {
    fail(tournamentId, "Ficheiro tem de ser uma imagem.");
  }

  const kindRaw = String(formData.get("kind") ?? "footer");
  const kind: SponsorKind = KINDS.includes(kindRaw as SponsorKind)
    ? (kindRaw as SponsorKind)
    : "footer";

  let duration_sec = Number(formData.get("duration_sec") ?? 8);
  if (!Number.isFinite(duration_sec)) duration_sec = 8;
  duration_sec = Math.max(2, Math.min(60, Math.round(duration_sec)));

  // Upload para storage
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${userId}/${tournamentId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("tournament-sponsors")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (upErr) fail(tournamentId, "Falha no upload: " + upErr.message);

  const { data: pub } = supabase.storage
    .from("tournament-sponsors")
    .getPublicUrl(path);

  // sort_order = max actual + 1 do mesmo kind
  const { data: last } = await supabase
    .from("tournament_sponsors")
    .select("sort_order")
    .eq("tournament_id", tournamentId)
    .eq("kind", kind)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const next = (last?.sort_order ?? -1) + 1;

  const { error } = await supabase.from("tournament_sponsors").insert({
    tournament_id: tournamentId,
    image_url: pub.publicUrl,
    kind,
    duration_sec,
    sort_order: next,
  });
  if (error) fail(tournamentId, error.message);
  revalidatePath(`/admin/tournaments/${tournamentId}/sponsors`);
}

export async function setKind(
  tournamentId: string,
  sponsorId: string,
  kind: SponsorKind,
) {
  const { supabase } = await ensureOwner(tournamentId);
  if (!KINDS.includes(kind)) fail(tournamentId, "Tipo inválido.");

  // Quando muda kind, recalcula sort_order no fim do novo grupo.
  const { data: last } = await supabase
    .from("tournament_sponsors")
    .select("sort_order")
    .eq("tournament_id", tournamentId)
    .eq("kind", kind)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const next = (last?.sort_order ?? -1) + 1;

  const { error } = await supabase
    .from("tournament_sponsors")
    .update({ kind, sort_order: next })
    .eq("id", sponsorId)
    .eq("tournament_id", tournamentId);
  if (error) fail(tournamentId, error.message);
  revalidatePath(`/admin/tournaments/${tournamentId}/sponsors`);
}

export async function setDuration(
  tournamentId: string,
  sponsorId: string,
  formData: FormData,
) {
  const { supabase } = await ensureOwner(tournamentId);
  let duration_sec = Number(formData.get("duration_sec") ?? 8);
  if (!Number.isFinite(duration_sec))
    fail(tournamentId, "Duração inválida.");
  duration_sec = Math.max(2, Math.min(60, Math.round(duration_sec)));

  const { error } = await supabase
    .from("tournament_sponsors")
    .update({ duration_sec })
    .eq("id", sponsorId)
    .eq("tournament_id", tournamentId);
  if (error) fail(tournamentId, error.message);
  revalidatePath(`/admin/tournaments/${tournamentId}/sponsors`);
}

export async function reorderSponsors(
  tournamentId: string,
  kind: SponsorKind,
  orderedIds: string[],
) {
  const { supabase } = await ensureOwner(tournamentId);
  if (!KINDS.includes(kind)) fail(tournamentId, "Tipo inválido.");
  for (let i = 0; i < orderedIds.length; i++) {
    await supabase
      .from("tournament_sponsors")
      .update({ sort_order: i })
      .eq("id", orderedIds[i])
      .eq("tournament_id", tournamentId)
      .eq("kind", kind);
  }
  revalidatePath(`/admin/tournaments/${tournamentId}/sponsors`);
}

export async function deleteSponsor(
  tournamentId: string,
  sponsorId: string,
) {
  const { supabase } = await ensureOwner(tournamentId);
  // Apaga apenas a row (ficheiro fica no storage — não dá conflito).
  // Se quiseres limpar o storage, pode-se fazer cleanup periódico.
  const { error } = await supabase
    .from("tournament_sponsors")
    .delete()
    .eq("id", sponsorId)
    .eq("tournament_id", tournamentId);
  if (error) fail(tournamentId, error.message);
  revalidatePath(`/admin/tournaments/${tournamentId}/sponsors`);
}
