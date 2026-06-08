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
  if (!data || data.owner_id !== user.id) redirect("/admin");

  return supabase;
}

/**
 * Toggle is_featured num jogo do PadelTeams. Faz upsert na tabela
 * padelteams_game_overrides (pk = tournament_id + padelteams_game_id).
 *
 * Usado pelo cavalete Cena 2 "EM FOCO" para escolher quais jogos
 * destacar no carrossel de fotos.
 */
export async function toggleFeatured(
  tournamentId: string,
  formData: FormData,
) {
  const supabase = await ensureOwner(tournamentId);
  const gameIdRaw = formData.get("game_id");
  const featuredRaw = formData.get("featured");

  const gameId = parseInt(String(gameIdRaw ?? ""), 10);
  const featured = featuredRaw === "true" || featuredRaw === "on";
  if (!Number.isFinite(gameId)) {
    redirect(
      `/admin/tournaments/${tournamentId}/featured?error=Game+ID+invalido`,
    );
  }

  // Upsert: insere se não existe, actualiza se existe
  const { error } = await supabase.from("padelteams_game_overrides").upsert(
    {
      tournament_id: tournamentId,
      padelteams_game_id: gameId,
      is_featured: featured,
    },
    { onConflict: "tournament_id,padelteams_game_id" },
  );

  if (error) {
    redirect(
      `/admin/tournaments/${tournamentId}/featured?error=` +
        encodeURIComponent(error.message),
    );
  }

  revalidatePath(`/admin/tournaments/${tournamentId}/featured`);
}
