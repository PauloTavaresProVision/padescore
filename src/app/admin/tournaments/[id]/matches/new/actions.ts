"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const VALID_CATEGORIES = ["M1", "M2", "M3", "M4", "F1", "F2", "F3", "F4"] as const;
type Category = (typeof VALID_CATEGORIES)[number];

async function uploadPhoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  file: File | null,
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("player-photos")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw new Error("Falha no upload da foto: " + error.message);
  const { data: pub } = supabase.storage.from("player-photos").getPublicUrl(path);
  return pub.publicUrl;
}

function uuidOrNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
    ? s
    : null;
}

export async function createMatch(tournamentId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const categoryRaw = String(formData.get("category") ?? "").trim();
  const category: Category | null =
    VALID_CATEGORIES.includes(categoryRaw as Category) ? (categoryRaw as Category) : null;

  let team_a_photo_url: string | null = null;
  let team_b_photo_url: string | null = null;
  try {
    [team_a_photo_url, team_b_photo_url] = await Promise.all([
      uploadPhoto(supabase, user.id, formData.get("team_a_photo") as File | null),
      uploadPhoto(supabase, user.id, formData.get("team_b_photo") as File | null),
    ]);
  } catch (e) {
    redirect(
      `/admin/tournaments/${tournamentId}/matches/new?error=` +
        encodeURIComponent(e instanceof Error ? e.message : "Falha no upload"),
    );
  }

  function n(k: string): string {
    return String(formData.get(k) ?? "").trim();
  }
  function nOrNull(k: string): string | null {
    return n(k) || null;
  }

  const payload = {
    tournament_id: tournamentId,
    court_name: n("court_name") || "Court 1",
    category,
    // Nome longo (TV)
    team_a_player1: n("team_a_player1"),
    team_a_player2: nOrNull("team_a_player2"),
    team_b_player1: n("team_b_player1"),
    team_b_player2: nOrNull("team_b_player2"),
    // Nome curto (OBS) — fallback ao longo se em branco
    team_a_player1_short: nOrNull("team_a_player1_short") ?? nOrNull("team_a_player1"),
    team_a_player2_short: nOrNull("team_a_player2_short"),
    team_b_player1_short: nOrNull("team_b_player1_short") ?? nOrNull("team_b_player1"),
    team_b_player2_short: nOrNull("team_b_player2_short"),
    // FKs catálogo
    team_a_player1_id: uuidOrNull(formData.get("team_a_player1_id")),
    team_a_player2_id: uuidOrNull(formData.get("team_a_player2_id")),
    team_b_player1_id: uuidOrNull(formData.get("team_b_player1_id")),
    team_b_player2_id: uuidOrNull(formData.get("team_b_player2_id")),
    team_a_photo_url,
    team_b_photo_url,
    golden_point: formData.get("golden_point") === "on",
    sets_to_win: Number(formData.get("sets_to_win") ?? 2),
    games_per_set: Number(formData.get("games_per_set") ?? 6),
    tiebreak_at: Number(formData.get("tiebreak_at") ?? 6),
    tiebreak_points: Number(formData.get("tiebreak_points") ?? 7),
    final_set_super_tiebreak: formData.get("final_set_super_tiebreak") === "on",
  };

  if (!payload.team_a_player1 || !payload.team_b_player1) {
    redirect(
      `/admin/tournaments/${tournamentId}/matches/new?error=` +
        encodeURIComponent("Pelo menos 1 jogador por equipa é obrigatório."),
    );
  }

  const { data, error } = await supabase
    .from("matches")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    redirect(
      `/admin/tournaments/${tournamentId}/matches/new?error=` +
        encodeURIComponent(error.message),
    );
  }

  redirect(`/admin/tournaments/${tournamentId}/matches/${data!.id}`);
}
