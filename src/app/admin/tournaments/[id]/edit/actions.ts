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

  const { data } = await supabase
    .from("tournaments")
    .select("owner_id")
    .eq("id", tournamentId)
    .single();

  if (!data || data.owner_id !== user.id) {
    redirect("/admin");
  }
  return { supabase, user };
}

async function uploadToBucket(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  bucket: string,
  file: File | null,
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const ext = file.name.split(".").pop() ?? "png";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw new Error(`Falha no upload (${bucket}): ${error.message}`);
  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
  return pub.publicUrl;
}

export async function updateTournament(tournamentId: string, formData: FormData) {
  const { supabase, user } = await ensureOwner(tournamentId);

  const name = String(formData.get("name") ?? "").trim();
  const primary_color = String(formData.get("primary_color") ?? "#10b981");
  const remove_logo = formData.get("remove_logo") === "on";
  const remove_tv_bg = formData.get("remove_tv_background") === "on";
  const remove_tv_standby = formData.get("remove_tv_standby") === "on";
  const logo = formData.get("logo") as File | null;
  const tvBg = formData.get("tv_background") as File | null;
  const tvStandby = formData.get("tv_standby") as File | null;

  if (!name) {
    redirect(
      `/admin/tournaments/${tournamentId}/edit?error=` +
        encodeURIComponent("O nome é obrigatório."),
    );
  }

  const patch: {
    name: string;
    primary_color: string;
    logo_url?: string | null;
    tv_background_url?: string | null;
    tv_standby_url?: string | null;
    updated_at: string;
  } = {
    name,
    primary_color,
    updated_at: new Date().toISOString(),
  };

  try {
    if (remove_logo) {
      patch.logo_url = null;
    } else {
      const newLogoUrl = await uploadToBucket(supabase, user.id, "tournament-logos", logo);
      if (newLogoUrl) patch.logo_url = newLogoUrl;
    }

    if (remove_tv_bg) {
      patch.tv_background_url = null;
    } else {
      const newTvUrl = await uploadToBucket(supabase, user.id, "tournament-logos", tvBg);
      if (newTvUrl) patch.tv_background_url = newTvUrl;
    }

    if (remove_tv_standby) {
      patch.tv_standby_url = null;
    } else {
      const newStandbyUrl = await uploadToBucket(
        supabase,
        user.id,
        "tournament-logos",
        tvStandby,
      );
      if (newStandbyUrl) patch.tv_standby_url = newStandbyUrl;
    }
  } catch (e) {
    redirect(
      `/admin/tournaments/${tournamentId}/edit?error=` +
        encodeURIComponent(e instanceof Error ? e.message : "Falha no upload"),
    );
  }

  const { error } = await supabase
    .from("tournaments")
    .update(patch)
    .eq("id", tournamentId);

  if (error) {
    redirect(
      `/admin/tournaments/${tournamentId}/edit?error=` +
        encodeURIComponent(error.message),
    );
  }

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath("/admin");
  redirect(`/admin/tournaments/${tournamentId}`);
}

export async function deleteTournament(tournamentId: string) {
  const { supabase } = await ensureOwner(tournamentId);
  await supabase.from("tournaments").delete().eq("id", tournamentId);
  redirect("/admin");
}
