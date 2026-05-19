import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyMatchEvent } from "@/lib/scoring/apply";

const Body = z.discriminatedUnion("type", [
  z.object({ type: z.literal("point"), team: z.enum(["A", "B"]) }),
  z.object({ type: z.literal("undo") }),
  z.object({ type: z.literal("undo_last_game") }),
  z.object({ type: z.literal("undo_last_set") }),
  z.object({ type: z.literal("swap_server") }),
  z.object({ type: z.literal("manual"), payload: z.record(z.string(), z.unknown()) }),
]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const lookupColumn = token.length === 8 ? "operator_short_code" : "operator_token";
  const { data: match, error } = await supabase
    .from("matches")
    .select("id")
    .eq(lookupColumn, token.toLowerCase())
    .single();

  if (error || !match) {
    return NextResponse.json({ error: "Token inválido" }, { status: 404 });
  }

  const result = await applyMatchEvent(supabase, match.id, parsed.data);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, seq: result.seq, state: result.state });
}
