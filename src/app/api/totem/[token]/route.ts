import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Endpoint que alimenta o totem digital de cada campo.
 *
 * URL: GET /api/totem/[token]
 *
 * Auth: o token (40 chars opacos) IDENTIFICA o totem. Quem tiver acesso ao
 * URL consegue ver os dados desse campo — não há informação privada aqui
 * (nomes de jogadores e fotos são públicos por natureza).
 *
 * Resposta: JSON com tournament, court, currentMatch, nextMatch, sponsors.
 * Inclui ETag para a app fazer cache eficiente (304 quando nada mudou).
 *
 * Side-effect: actualiza totems.last_seen_at (heartbeat) para o admin
 * saber se o totem está online.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token || token.length < 20) {
    return NextResponse.json({ error: "Token inválido" }, { status: 404 });
  }

  const supabase = createAdminClient();

  // 1) Localiza o totem pelo token
  const { data: totem } = await supabase
    .from("totems")
    .select("id, tournament_id, court_id, name")
    .eq("api_token", token)
    .maybeSingle();
  if (!totem) {
    return NextResponse.json({ error: "Totem não encontrado" }, { status: 404 });
  }

  // 2) Buscar tudo em paralelo
  const [
    { data: tournament },
    { data: court },
    { data: matchesRaw },
    { data: sponsorsRaw },
  ] = await Promise.all([
    supabase
      .from("tournaments")
      .select("id, name, logo_url, primary_color")
      .eq("id", totem.tournament_id)
      .maybeSingle(),
    supabase
      .from("courts")
      .select("id, name")
      .eq("id", totem.court_id)
      .maybeSingle(),
    // Current + next match: scheduled ou live neste campo, mais recente primeiro
    supabase
      .from("matches")
      .select(
        "id, status, scheduled_at, team_a_player1, team_a_player2, team_b_player1, team_b_player2, team_a_player1_short, team_a_player2_short, team_b_player1_short, team_b_player2_short, team_a_player1_id, team_a_player2_id, team_b_player1_id, team_b_player2_id, team_a_player1_photo_url, team_a_player2_photo_url, team_b_player1_photo_url, team_b_player2_photo_url",
      )
      .eq("tournament_id", totem.tournament_id)
      .eq("court_id", totem.court_id)
      .in("status", ["live", "scheduled"])
      .order("status", { ascending: true }) // 'live' < 'scheduled' alfabeticamente
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .limit(2),
    supabase
      .from("tournament_sponsors")
      .select("image_url, kind, duration_sec, sort_order")
      .eq("tournament_id", totem.tournament_id)
      .order("kind", { ascending: true })
      .order("sort_order", { ascending: true }),
  ]);

  // 3) Buscar fotos individuais dos jogadores (catálogo) referenciados
  const matches = matchesRaw ?? [];
  const playerIds = Array.from(
    new Set(
      matches.flatMap((m) =>
        [
          m.team_a_player1_id,
          m.team_a_player2_id,
          m.team_b_player1_id,
          m.team_b_player2_id,
        ].filter((id): id is string => Boolean(id)),
      ),
    ),
  );
  const photoByPlayer = new Map<string, string | null>();
  if (playerIds.length > 0) {
    const { data: players } = await supabase
      .from("players")
      .select("id, photo_url")
      .in("id", playerIds);
    for (const p of players ?? []) {
      photoByPlayer.set(p.id, p.photo_url);
    }
  }

  // 4) Construir matches para a resposta
  type PlayerOut = {
    name: string;
    shortName: string | null;
    photoUrl: string | null;
  } | null;
  type MatchOut = {
    id: string;
    status: string;
    scheduledAt: string | null;
    teamA: { p1: PlayerOut; p2: PlayerOut };
    teamB: { p1: PlayerOut; p2: PlayerOut };
  };
  function buildPlayer(
    name: string | null,
    shortName: string | null,
    playerId: string | null,
    fallbackPhoto: string | null,
  ): PlayerOut {
    if (!name) return null;
    return {
      name,
      shortName,
      // Prioridade: player do catálogo (sempre actualizado) > foto antiga
      // no match (legado).
      photoUrl: (playerId && photoByPlayer.get(playerId)) || fallbackPhoto,
    };
  }
  function buildMatch(m: (typeof matches)[number]): MatchOut {
    return {
      id: m.id,
      status: m.status,
      scheduledAt: m.scheduled_at,
      teamA: {
        p1: buildPlayer(
          m.team_a_player1,
          m.team_a_player1_short,
          m.team_a_player1_id,
          m.team_a_player1_photo_url,
        ),
        p2: buildPlayer(
          m.team_a_player2,
          m.team_a_player2_short,
          m.team_a_player2_id,
          m.team_a_player2_photo_url,
        ),
      },
      teamB: {
        p1: buildPlayer(
          m.team_b_player1,
          m.team_b_player1_short,
          m.team_b_player1_id,
          m.team_b_player1_photo_url,
        ),
        p2: buildPlayer(
          m.team_b_player2,
          m.team_b_player2_short,
          m.team_b_player2_id,
          m.team_b_player2_photo_url,
        ),
      },
    };
  }

  const currentMatch = matches[0] ? buildMatch(matches[0]) : null;
  const nextMatch = matches[1] ? buildMatch(matches[1]) : null;

  // 5) Sponsors agrupados por kind
  const allSponsors = sponsorsRaw ?? [];
  const footerSponsors = allSponsors
    .filter((s) => s.kind === "footer")
    .map((s) => ({ imageUrl: s.image_url }));
  const fullscreenSponsors = allSponsors
    .filter((s) => s.kind === "fullscreen")
    .map((s) => ({ imageUrl: s.image_url, durationSec: s.duration_sec }));

  // 6) Payload final
  const payload = {
    tournament: tournament
      ? {
          name: tournament.name,
          logoUrl: tournament.logo_url,
          primaryColor: tournament.primary_color ?? "#0066b3",
        }
      : null,
    court: court?.name ?? totem.name,
    currentMatch,
    nextMatch,
    sponsors: {
      footer: footerSponsors,
      fullscreen: fullscreenSponsors,
    },
    serverTime: new Date().toISOString(),
  };

  // 7) ETag (hash do payload sem serverTime — para 304 funcionar)
  const stableForHash = { ...payload, serverTime: undefined };
  const etag = `"${createHash("sha256")
    .update(JSON.stringify(stableForHash))
    .digest("hex")
    .slice(0, 16)}"`;

  // Heartbeat: actualiza last_seen_at AGORA (await — fire-and-forget é
  // pouco fiável em runtimes serverless e até em Next dev às vezes
  // larga o promise antes do UPDATE atingir a DB).
  await supabase
    .from("totems")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", totem.id);

  // Cliente já tem a última versão?
  const ifNoneMatch = req.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: etag },
    });
  }

  return NextResponse.json(payload, {
    headers: {
      ETag: etag,
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
