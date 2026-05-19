import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/tv/<tv_code>/active
 * Devolve o short_code do jogo actualmente no ar nesse canal de TV
 * (ou null = ecrã de espera). A página /tv/live faz poll a isto e troca
 * sozinha quando o operador muda o jogo activo.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const supabase = createAdminClient();

  const { data: t } = await supabase
    .from("tournaments")
    .select("tv_active_match_id")
    .eq("tv_code", code.toLowerCase())
    .single();

  if (!t) {
    return NextResponse.json({ matchCode: null }, { status: 404 });
  }
  if (!t.tv_active_match_id) {
    return NextResponse.json({ matchCode: null });
  }

  const { data: m } = await supabase
    .from("matches")
    .select("short_code")
    .eq("id", t.tv_active_match_id)
    .single();

  return NextResponse.json({ matchCode: m?.short_code ?? null });
}
