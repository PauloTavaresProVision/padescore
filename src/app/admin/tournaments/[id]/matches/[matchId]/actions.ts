"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyMatchEvent } from "@/lib/scoring/apply";

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
}

export async function adminAddPoint(
  tournamentId: string,
  matchId: string,
  team: "A" | "B",
) {
  await ensureOwner(tournamentId);
  const supabase = createAdminClient();
  await applyMatchEvent(supabase, matchId, { type: "point", team });
}

export async function adminUndo(tournamentId: string, matchId: string) {
  await ensureOwner(tournamentId);
  const supabase = createAdminClient();
  await applyMatchEvent(supabase, matchId, { type: "undo" });
}

export async function adminResetMatch(tournamentId: string, matchId: string) {
  await ensureOwner(tournamentId);
  const supabase = createAdminClient();

  await supabase.from("match_events").delete().eq("match_id", matchId);

  await supabase
    .from("match_state")
    .update({
      points_a: "0",
      points_b: "0",
      games_a: 0,
      games_b: 0,
      sets_a: 0,
      sets_b: 0,
      sets_history: [],
      server: "A",
      in_tiebreak: false,
      in_super_tiebreak: false,
      is_finished: false,
      winner: null,
      last_event_seq: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("match_id", matchId);

  await supabase
    .from("matches")
    .update({ status: "scheduled", started_at: null, finished_at: null })
    .eq("id", matchId);

  revalidatePath(`/admin/tournaments/${tournamentId}/matches/${matchId}`);
}

export async function adminRegenerateToken(
  tournamentId: string,
  matchId: string,
) {
  await ensureOwner(tournamentId);
  const supabase = createAdminClient();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  await supabase.from("matches").update({ operator_token: token }).eq("id", matchId);
  revalidatePath(`/admin/tournaments/${tournamentId}/matches/${matchId}`);
}

export async function adminDeleteMatch(
  tournamentId: string,
  matchId: string,
) {
  await ensureOwner(tournamentId);
  const supabase = await createClient();
  await supabase.from("matches").delete().eq("id", matchId);
  redirect(`/admin/tournaments/${tournamentId}`);
}

// Põe este jogo "no ar" no canal de TV do torneio (a TV troca sozinha).
export async function setTvMatch(tournamentId: string, matchId: string) {
  await ensureOwner(tournamentId);
  const supabase = await createClient();
  await supabase
    .from("tournaments")
    .update({ tv_active_match_id: matchId })
    .eq("id", tournamentId);
  revalidatePath(`/admin/tournaments/${tournamentId}/matches/${matchId}`);
  revalidatePath(`/admin/tournaments/${tournamentId}`);
}

// Tira qualquer jogo da TV → ecrã de espera.
export async function clearTvMatch(tournamentId: string, matchId: string) {
  await ensureOwner(tournamentId);
  const supabase = await createClient();
  await supabase
    .from("tournaments")
    .update({ tv_active_match_id: null })
    .eq("id", tournamentId);
  revalidatePath(`/admin/tournaments/${tournamentId}/matches/${matchId}`);
  revalidatePath(`/admin/tournaments/${tournamentId}`);
}

// ---------------------------------------------------------------------------
// Editar um jogo já criado
// ---------------------------------------------------------------------------
const VALID_CATEGORIES = ["M1", "M2", "M3", "M4", "F1", "F2", "F3", "F4"] as const;
type Category = (typeof VALID_CATEGORIES)[number];

function uuidOrNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
    ? s
    : null;
}

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

export async function updateMatch(
  tournamentId: string,
  matchId: string,
  formData: FormData,
) {
  await ensureOwner(tournamentId);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const editUrl = `/admin/tournaments/${tournamentId}/matches/${matchId}/edit`;

  function n(k: string): string {
    return String(formData.get(k) ?? "").trim();
  }
  function nOrNull(k: string): string | null {
    return n(k) || null;
  }

  const categoryRaw = n("category");
  const category: Category | null = VALID_CATEGORIES.includes(
    categoryRaw as Category,
  )
    ? (categoryRaw as Category)
    : null;

  if (!n("team_a_player1") || !n("team_b_player1")) {
    redirect(
      editUrl +
        "?error=" +
        encodeURIComponent("Pelo menos 1 jogador por equipa é obrigatório."),
    );
  }

  // Fotos: só substitui se vier composite NOVO (input não vazio).
  let newPhotoA: string | null = null;
  let newPhotoB: string | null = null;
  try {
    [newPhotoA, newPhotoB] = await Promise.all([
      uploadPhoto(supabase, user.id, formData.get("team_a_photo") as File | null),
      uploadPhoto(supabase, user.id, formData.get("team_b_photo") as File | null),
    ]);
  } catch (e) {
    redirect(
      editUrl +
        "?error=" +
        encodeURIComponent(e instanceof Error ? e.message : "Falha no upload"),
    );
  }

  const patch: Record<string, unknown> = {
    court_name: n("court_name") || "Court 1",
    category,
    team_a_player1: n("team_a_player1"),
    team_a_player2: nOrNull("team_a_player2"),
    team_b_player1: n("team_b_player1"),
    team_b_player2: nOrNull("team_b_player2"),
    team_a_player1_short: nOrNull("team_a_player1_short") ?? nOrNull("team_a_player1"),
    team_a_player2_short: nOrNull("team_a_player2_short"),
    team_b_player1_short: nOrNull("team_b_player1_short") ?? nOrNull("team_b_player1"),
    team_b_player2_short: nOrNull("team_b_player2_short"),
    team_a_player1_id: uuidOrNull(formData.get("team_a_player1_id")),
    team_a_player2_id: uuidOrNull(formData.get("team_a_player2_id")),
    team_b_player1_id: uuidOrNull(formData.get("team_b_player1_id")),
    team_b_player2_id: uuidOrNull(formData.get("team_b_player2_id")),
    golden_point: formData.get("golden_point") === "on",
    sets_to_win: Number(formData.get("sets_to_win") ?? 2),
    games_per_set: Number(formData.get("games_per_set") ?? 6),
    tiebreak_at: Number(formData.get("tiebreak_at") ?? 6),
    tiebreak_points: Number(formData.get("tiebreak_points") ?? 7),
    final_set_super_tiebreak: formData.get("final_set_super_tiebreak") === "on",
  };
  // Só toca nas fotos se houver composite novo (senão mantém as actuais).
  if (newPhotoA) patch.team_a_photo_url = newPhotoA;
  if (newPhotoB) patch.team_b_photo_url = newPhotoB;

  const { error } = await supabase
    .from("matches")
    .update(patch)
    .eq("id", matchId);

  if (error) {
    redirect(editUrl + "?error=" + encodeURIComponent(error.message));
  }

  revalidatePath(`/admin/tournaments/${tournamentId}/matches/${matchId}`);
  redirect(`/admin/tournaments/${tournamentId}/matches/${matchId}`);
}
