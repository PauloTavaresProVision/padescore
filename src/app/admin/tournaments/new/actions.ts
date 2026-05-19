"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

export async function createTournament(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const primary_color = String(formData.get("primary_color") ?? "#0033A0");
  const logo = formData.get("logo") as File | null;
  const tvBg = formData.get("tv_background") as File | null;

  if (!name) {
    redirect("/admin/tournaments/new?error=" + encodeURIComponent("O nome é obrigatório."));
  }

  let logo_url: string | null = null;
  let tv_background_url: string | null = null;
  try {
    [logo_url, tv_background_url] = await Promise.all([
      uploadToBucket(supabase, user.id, "tournament-logos", logo),
      uploadToBucket(supabase, user.id, "tournament-logos", tvBg),
    ]);
  } catch (e) {
    redirect(
      "/admin/tournaments/new?error=" +
        encodeURIComponent(e instanceof Error ? e.message : "Falha no upload"),
    );
  }

  const { data, error } = await supabase
    .from("tournaments")
    .insert({
      name,
      primary_color,
      logo_url,
      tv_background_url,
      owner_id: user.id,
    })
    .select("id")
    .single();

  if (error) {
    redirect("/admin/tournaments/new?error=" + encodeURIComponent(error.message));
  }

  redirect(`/admin/tournaments/${data!.id}`);
}
