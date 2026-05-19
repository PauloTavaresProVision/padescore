import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Legacy: a rota antiga continua a funcionar mas redirecciona para a URL curta.
export default async function LegacyScoreboardPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("matches")
    .select("short_code")
    .eq("id", matchId)
    .single();
  if (!data?.short_code) notFound();
  redirect(`/tv/${data.short_code}`);
}
