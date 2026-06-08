import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/reschedule-confirm
 *
 * Endpoint público (token-based). Grava a decisão (accept/reject) de um dos
 * jogadores envolvidos num pedido de alteração de horário.
 *
 * Body: { token: "abc...", decision: "accepted" | "rejected" }
 */
export async function POST(req: Request) {
  let body: { token?: string; decision?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const token = String(body.token ?? "").trim();
  const decision = String(body.decision ?? "").trim();

  if (!token || token.length < 10) {
    return NextResponse.json({ error: "Token inválido" }, { status: 400 });
  }
  if (decision !== "accepted" && decision !== "rejected") {
    return NextResponse.json(
      { error: "Decisão deve ser 'accepted' ou 'rejected'" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("reschedule_acceptances")
    .select("id, status")
    .eq("acceptance_token", token)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Token não encontrado" }, { status: 404 });
  }

  const { error } = await supabase
    .from("reschedule_acceptances")
    .update({
      status: decision,
      decided_at: new Date().toISOString(),
      decided_via: "whatsapp_link",
    })
    .eq("id", existing.id);

  if (error) {
    return NextResponse.json(
      { error: "Falha a guardar decisão", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ status: decision }, { status: 200 });
}
