"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function uploadPhoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  file: File | null,
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const ext = file.name.split(".").pop() ?? "png";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("player-photos")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw new Error("Falha no upload da foto: " + error.message);
  const { data: pub } = supabase.storage.from("player-photos").getPublicUrl(path);
  return pub.publicUrl;
}

export async function createPlayer(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const short_name = String(formData.get("short_name") ?? "").trim() || null;
  const mirror = formData.get("mirror") === "on";
  if (!name) redirect("/admin/players/new?error=" + encodeURIComponent("Nome é obrigatório."));

  let photo_url: string | null = null;
  try {
    photo_url = await uploadPhoto(supabase, user.id, formData.get("photo") as File | null);
  } catch (e) {
    redirect(
      "/admin/players/new?error=" +
        encodeURIComponent(e instanceof Error ? e.message : "Falha no upload"),
    );
  }

  const { error } = await supabase.from("players").insert({
    owner_id: user.id,
    name,
    short_name,
    photo_url,
    mirror,
  });

  if (error) {
    redirect("/admin/players/new?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/admin/players");
  redirect("/admin/players");
}

export async function updatePlayer(id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const short_name = String(formData.get("short_name") ?? "").trim() || null;
  const mirror = formData.get("mirror") === "on";
  if (!name) redirect(`/admin/players?error=` + encodeURIComponent("Nome é obrigatório."));

  const newPhoto = formData.get("photo") as File | null;
  let photo_url: string | undefined;
  if (newPhoto && newPhoto.size > 0) {
    try {
      photo_url = (await uploadPhoto(supabase, user.id, newPhoto)) ?? undefined;
    } catch (e) {
      redirect(
        "/admin/players?error=" +
          encodeURIComponent(e instanceof Error ? e.message : "Falha no upload"),
      );
    }
  }

  const patch: Record<string, unknown> = { name, short_name, mirror };
  if (photo_url) patch.photo_url = photo_url;

  const { error } = await supabase.from("players").update(patch).eq("id", id);
  if (error) {
    redirect("/admin/players?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/admin/players");
  redirect("/admin/players");
}

export async function deletePlayer(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("players").delete().eq("id", id);
  if (error) {
    redirect("/admin/players?error=" + encodeURIComponent(error.message));
  }
  revalidatePath("/admin/players");
}

export async function toggleMirror(id: string, value: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("players").update({ mirror: value }).eq("id", id);
  revalidatePath("/admin/players");
}
