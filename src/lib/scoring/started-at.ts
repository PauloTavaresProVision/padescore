import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Devolve o `started_at` do jogo. Se a coluna estiver null (ex.: bug histórico
 * antes do update síncrono), tenta inferir do primeiro evento registado.
 * Devolve null se não houver eventos ainda.
 */
export async function resolveStartedAt(
  supabase: SupabaseClient,
  matchId: string,
  startedAt: string | null,
): Promise<string | null> {
  if (startedAt) return startedAt;

  const { data } = await supabase
    .from("match_events")
    .select("created_at")
    .eq("match_id", matchId)
    .order("seq", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data?.created_at ?? null;
}
