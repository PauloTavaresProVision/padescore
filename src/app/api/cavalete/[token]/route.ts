import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCompetitionSnapshot } from "@/lib/padelteams/client";
import {
  transformGame,
  bucketCourtGames,
  type CavaletteGame,
  type CavaletePayload,
} from "@/lib/padelteams/transform";

export const dynamic = "force-dynamic";

/**
 * Endpoint do CAVALETE (versão 1080×1920, 2 campos por dispositivo).
 *
 * URL: GET /api/cavalete/[token]
 *
 * O token identifica um totem na DB. O totem tem court_id (obrigatório) e
 * court_id_2 (opcional — quando preenchido, é cavalete; quando null, é
 * totem antigo de 1 campo).
 *
 * Para cada um dos 2 courts:
 *   - busca os jogos no PadelTeams (filtrado por padelteams_field_id)
 *   - infere "ao vivo agora" (heurística por hora)
 *   - junta próximos e resultados de hoje
 *
 * Heartbeat: actualiza last_seen_at do totem para o admin saber se
 * está online.
 *
 * Cache: o snapshot do PadelTeams é cacheado (30s) no lib/padelteams.
 * Aqui adicionamos ETag para o cliente poupar bytes em polling.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token || token.length < 8) {
    return NextResponse.json({ error: "Token inválido" }, { status: 404 });
  }

  const supabase = createAdminClient();

  // 1) Localiza o totem/cavalete
  const { data: totem } = await supabase
    .from("totems")
    .select("id, tournament_id, court_id, court_id_2, name")
    .eq("api_token", token)
    .maybeSingle();
  if (!totem) {
    return NextResponse.json(
      { error: "Cavalete não encontrado" },
      { status: 404 },
    );
  }

  // 2) Busca em paralelo: torneio, courts, sponsors, overrides, player photos
  const courtIds = [totem.court_id, totem.court_id_2].filter(
    (c): c is string => c !== null,
  );

  const [
    { data: tournament },
    { data: courtsRaw },
    { data: sponsorsRaw },
    { data: overridesRaw },
    { data: playersRaw },
  ] = await Promise.all([
    // Tenta pedir colunas novas (migration 0016). Se ainda não foram
    // aplicadas, fallback para colunas base. Defaults aplicados depois.
    supabase
      .from("tournaments")
      .select(
        "id, name, padelteams_competition_code, scene_main_duration_sec, scene_sponsors_duration_sec",
      )
      .eq("id", totem.tournament_id)
      .maybeSingle()
      .then(async (r) => {
        if (r.error && /scene_(main|sponsors)_duration_sec/i.test(r.error.message)) {
          // Colunas ainda não existem — re-tentar sem elas
          return await supabase
            .from("tournaments")
            .select("id, name, padelteams_competition_code")
            .eq("id", totem.tournament_id)
            .maybeSingle();
        }
        return r;
      }),
    supabase
      .from("courts")
      .select("id, name, padelteams_field_id, sort_order")
      .in("id", courtIds)
      .order("sort_order"),
    supabase
      .from("tournament_sponsors")
      .select("image_url, kind, duration_sec, sort_order")
      .eq("tournament_id", totem.tournament_id)
      .order("kind")
      .order("sort_order"),
    supabase
      .from("padelteams_game_overrides")
      .select("padelteams_game_id, is_featured")
      .eq("tournament_id", totem.tournament_id),
    supabase
      .from("players")
      .select("padelteams_player_id, photo_url")
      .not("padelteams_player_id", "is", null)
      .not("photo_url", "is", null),
  ]);

  if (!tournament) {
    return NextResponse.json(
      { error: "Torneio não encontrado" },
      { status: 404 },
    );
  }

  // Preview mode (?preview=1): usado pela página admin Sponsors para mostrar
  // o cavalete sem ter que ter PadelTeams configurado. Ignora a chamada à
  // API externa, devolve mocks para jogos e usa os sponsors reais da DB.
  const urlEarly = new URL(req.url);
  const previewMode = urlEarly.searchParams.get("preview") === "1";

  // 3) Snapshot do PadelTeams (cached) — ignorado em previewMode
  const competitionCode = tournament.padelteams_competition_code;
  if (!previewMode && !competitionCode) {
    return NextResponse.json(
      {
        error: "Torneio sem PadelTeams configurado",
        hint: "Configura em /admin/.../padelteams",
      },
      { status: 409 },
    );
  }

  let snapshot: Awaited<ReturnType<typeof getCompetitionSnapshot>> | null = null;
  if (!previewMode && competitionCode) {
    try {
      snapshot = await getCompetitionSnapshot(competitionCode);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      return NextResponse.json(
        { error: "Falha a contactar PadelTeams", detail: msg },
        { status: 502 },
      );
    }
  }

  // 4) Indexes para o transform
  const courtByFieldId = new Map<number, { id: string; name: string }>();
  for (const c of courtsRaw ?? []) {
    if (c.padelteams_field_id) {
      courtByFieldId.set(c.padelteams_field_id, { id: c.id, name: c.name });
    }
  }

  const photoOverrides = new Map<number, string>();
  for (const p of playersRaw ?? []) {
    if (p.padelteams_player_id && p.photo_url) {
      photoOverrides.set(p.padelteams_player_id, p.photo_url);
    }
  }

  const featuredGameIds = new Set<number>(
    (overridesRaw ?? [])
      .filter((o) => o.is_featured)
      .map((o) => o.padelteams_game_id),
  );

  // 5) Filtrar jogos para os fields deste cavalete e transformar
  const ourFieldIds = new Set(courtByFieldId.keys());
  const transformedGames: CavaletteGame[] = snapshot
    ? snapshot.games
        .filter((g) => g.field && ourFieldIds.has(g.field.id))
        .map((g) =>
          transformGame(g, { photoOverrides, courtByFieldId, featuredGameIds }),
        )
    : [];

  // 6) Categorizar por court
  //
  // Dev/teste: ?as_of=YYYY-MM-DD permite simular "como se hoje fosse outro
  // dia" — útil quando o torneio do PadelTeams já terminou e queremos ver
  // o que apareceria no dia X. Em produção é ignorado por segurança.
  const url = new URL(req.url);
  const asOfParam = url.searchParams.get("as_of");
  const now =
    process.env.NODE_ENV !== "production" && asOfParam
      ? (() => {
          // Tomar como "meio-dia local" no dia indicado, para ficar entre
          // os jogos da manhã e da tarde
          const d = new Date(`${asOfParam}T12:00:00`);
          return isNaN(d.getTime()) ? new Date() : d;
        })()
      : new Date();
  const cavaleteCourts = (courtsRaw ?? []).map((c) => ({
    id: c.id,
    name: c.name,
  }));

  const liveByCourt: (CavaletteGame | null)[] = [];
  const upcomingAll: CavaletteGame[] = [];
  const resultsAll: CavaletteGame[] = [];

  for (const court of cavaleteCourts) {
    const gamesHere = transformedGames.filter((g) => g.court?.id === court.id);
    const bucket = bucketCourtGames(court, gamesHere, now);
    liveByCourt.push(bucket.live);
    upcomingAll.push(...bucket.upcoming);
    resultsAll.push(...bucket.results);
  }

  // Dev/teste: ?demo=1 injecta jogos mock nos cards para vermos o visual
  // com dados a sério, mesmo quando o torneio do PadelTeams não tem jogos
  // a decorrer agora.
  //
  // ?preview=1 (modo admin Sponsors): também activa demo para mostrar
  // jogos mock — mas mantém os sponsors REAIS da DB (ver bloco em baixo).
  const demoMode =
    (process.env.NODE_ENV !== "production" &&
      url.searchParams.get("demo") === "1") ||
    previewMode;
  if (demoMode) {
    if (cavaleteCourts[0] && !liveByCourt[0]) {
      liveByCourt[0] = mockLiveGame(
        cavaleteCourts[0],
        "Carlos Sousa",
        "Sérgio Vieira",
        "Nicolau Martins",
        "Wojtek Drabkowski",
        new Date(now.getTime() - 45 * 60_000),
        [{ a: 6, b: 4, type: "set" }, { a: 4, b: 3, type: "set" }],
      );
    }
    if (cavaleteCourts[1] && !liveByCourt[1]) {
      liveByCourt[1] = mockLiveGame(
        cavaleteCourts[1],
        "João Pedro Gonçalves",
        "Miguel Andrade",
        "Francislaine Monteiro",
        "Rui Mendes",
        new Date(now.getTime() - 12 * 60_000),
        [],
      );
    }
    // 12 próximos para testar carrossel (2-3 páginas de 5)
    const upcomingMocks = [
      { h: 13, m: 30, c: 0, a1: "Ricardo Baptista", a2: "Nuno Matos", b1: "André Lima", b2: "Pedro Carvalho" },
      { h: 14, m: 0, c: 1, a1: "Sara Rodrigues", a2: "Inês Pires", b1: "Marta Vieira", b2: "Beatriz Almeida" },
      { h: 14, m: 30, c: 0, a1: "Alexandre Silva", a2: "Diogo Neves", b1: "Hugo Martins", b2: "Fábio Pereira" },
      { h: 15, m: 0, c: 1, a1: "João Figueiredo", a2: "Hugo Costa", b1: "Bernardo Melo", b2: "Luís Pereira" },
      { h: 15, m: 30, c: 0, a1: "Paulo Barros", a2: "Pedro Ricardo", b1: "Gonçalo Dias", b2: "Tomás Santos" },
      { h: 16, m: 0, c: 1, a1: "Daniel Reis", a2: "Vasco Pinto", b1: "Henrique Mota", b2: "Tiago Borges" },
      { h: 16, m: 30, c: 0, a1: "Carolina Lima", a2: "Joana Mendes", b1: "Patrícia Silva", b2: "Andreia Costa" },
      { h: 17, m: 0, c: 1, a1: "Filipe Macedo", a2: "Bruno Cardoso", b1: "Rafael Vieira", b2: "Sérgio Reis" },
      { h: 17, m: 30, c: 0, a1: "Ana Beatriz", a2: "Cláudia Sousa", b1: "Rita Fernandes", b2: "Mariana Pinto" },
      { h: 18, m: 0, c: 1, a1: "Luís Martins", a2: "Henrique Costa", b1: "Manuel Cunha", b2: "Diogo Soares" },
      { h: 19, m: 0, c: 0, a1: "Vítor Almeida", a2: "Rodrigo Pereira", b1: "Tiago Marques", b2: "Pedro Cardoso" },
      { h: 20, m: 30, c: 1, a1: "Joaquim Silva", a2: "André Carvalho", b1: "Fernando Lima", b2: "Eduardo Santos" },
    ];
    if (upcomingAll.length < 6) {
      // Substitui upcoming real (vazio ou pouco) por mock farto
      upcomingAll.length = 0;
      for (const m of upcomingMocks) {
        const court = cavaleteCourts[m.c];
        if (!court) continue;
        const t = new Date(now);
        t.setHours(m.h, m.m, 0, 0);
        upcomingAll.push(mockUpcoming(court, m.a1, m.a2, m.b1, m.b2, t));
      }
    }
    // 9 resultados (3 páginas de 3)
    const resultsMocks = [
      { h: 12, m: 30, c: 0, a1: "Carlos Pinto", a2: "Rui Santos", b1: "Pedro Lima", b2: "João Almeida", score: [{a:6,b:4,t:"set"},{a:6,b:2,t:"set"}], winner: 1 },
      { h: 11, m: 30, c: 1, a1: "Marta Carvalho", a2: "Sofia Domingues", b1: "Maria João", b2: "Beatriz Antunes", score: [{a:6,b:3,t:"set"},{a:6,b:1,t:"set"}], winner: 1 },
      { h: 11, m: 0, c: 0, a1: "Diogo Pinto", a2: "Ricardo Neves", b1: "Hugo Santos", b2: "Bruno Oliveira", score: [{a:7,b:5,t:"set"},{a:6,b:4,t:"set"}], winner: 1 },
      { h: 10, m: 30, c: 1, a1: "Inês Costa", a2: "Sara Pereira", b1: "Catarina Lopes", b2: "Helena Marques", score: [{a:4,b:6,t:"set"},{a:6,b:4,t:"set"},{a:10,b:7,t:"tie"}], winner: 1 },
      { h: 10, m: 0, c: 0, a1: "Nuno Almeida", a2: "Vasco Reis", b1: "Tiago Costa", b2: "Pedro Marques", score: [{a:3,b:6,t:"set"},{a:5,b:7,t:"set"}], winner: 2 },
      { h: 9, m: 30, c: 1, a1: "Mafalda Santos", a2: "Patrícia Vaz", b1: "Daniela Pires", b2: "Margarida Cunha", score: [{a:6,b:0,t:"set"},{a:6,b:1,t:"set"}], winner: 1 },
      { h: 9, m: 0, c: 0, a1: "Fábio Mendes", a2: "Eduardo Pinto", b1: "Gonçalo Cruz", b2: "Henrique Silva", score: [{a:6,b:7,t:"set"},{a:7,b:6,t:"set"},{a:10,b:8,t:"tie"}], winner: 1 },
      { h: 8, m: 30, c: 1, a1: "Filipa Rocha", a2: "Joana Brito", b1: "Carolina Tomás", b2: "Vânia Coelho", score: [{a:6,b:2,t:"set"},{a:3,b:6,t:"set"},{a:6,b:3,t:"set"}], winner: 1 },
      { h: 8, m: 0, c: 0, a1: "Luís Cardoso", a2: "Manuel Vieira", b1: "Ricardo Tavares", b2: "Sérgio Borges", score: [{a:2,b:6,t:"set"},{a:6,b:4,t:"set"},{a:6,b:8,t:"tie"}], winner: 2 },
    ];
    if (resultsAll.length < 6) {
      resultsAll.length = 0;
      for (const m of resultsMocks) {
        const court = cavaleteCourts[m.c];
        if (!court) continue;
        const t = new Date(now);
        t.setHours(m.h, m.m, 0, 0);
        const sets = m.score.map((s) => ({ a: s.a, b: s.b, type: s.t as "set" | "tie" }));
        resultsAll.push({
          padelteamsId: -1 * Math.floor(Math.random() * 1e6),
          startsAt: t.toISOString(),
          status: "closed",
          teamA: { padelteamsId: -1, name: `${m.a1} / ${m.a2}`, players: [{ padelteamsId: -1, name: m.a1, photoUrl: null }, { padelteamsId: -1, name: m.a2, photoUrl: null }] },
          teamB: { padelteamsId: -2, name: `${m.b1} / ${m.b2}`, players: [{ padelteamsId: -1, name: m.b1, photoUrl: null }, { padelteamsId: -1, name: m.b2, photoUrl: null }] },
          sets,
          scoreLabel: sets.map((s) => `${s.a}-${s.b}`).join(" "),
          winner: m.winner as 1 | 2,
          isFeatured: false,
          court,
        });
      }
    }
  }

  // Ordenar listas globais (interleaved entre courts)
  upcomingAll.sort(
    (a, b) =>
      new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );
  resultsAll.sort(
    (a, b) =>
      new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
  );

  // 7) Featured: jogos marcados is_featured que estão a decorrer agora
  //    (entre live e upcoming próximos) — para o carrossel "EM FOCO"
  const featured = transformedGames.filter(
    (g) => g.isFeatured && g.status === "open",
  );

  // 8) Sponsors
  const sponsors = sponsorsRaw ?? [];
  let footerSponsors = sponsors
    .filter((s) => s.kind === "footer")
    .map((s) => ({ imageUrl: s.image_url }));
  let fullscreenSponsors = sponsors
    .filter((s) => s.kind === "fullscreen")
    .map((s) => ({
      imageUrl: s.image_url,
      durationSec: s.duration_sec,
    }));

  // Demo: se não há sponsors reais, injecta uns mock para testar Cena 3
  // - 8 logos para o cartão grande (grid 4×2 todos visíveis)
  // - 12 logos para os 6 slots de parceiros (rotacionam 2 por slot)
  if (demoMode && footerSponsors.length === 0 && fullscreenSponsors.length === 0) {
    // Placeholders brancos com texto azul (simulam logos PNG)
    const mockLogo = (name: string) =>
      `https://placehold.co/400x200/ffffff/0a2856/png?text=${encodeURIComponent(name)}`;
    fullscreenSponsors = [
      { imageUrl: mockLogo("ATC"), durationSec: 8 },
      { imageUrl: mockLogo("GIANT SEGUROS"), durationSec: 8 },
      { imageUrl: mockLogo("DOM"), durationSec: 8 },
      { imageUrl: mockLogo("ALPROME"), durationSec: 8 },
      { imageUrl: mockLogo("DELTA Q"), durationSec: 8 },
      { imageUrl: mockLogo("CHANGAN"), durationSec: 8 },
      { imageUrl: mockLogo("CASA DOS FRESCOS"), durationSec: 8 },
      { imageUrl: mockLogo("ATLANTIDA WTA"), durationSec: 8 },
    ];
    footerSponsors = [
      { imageUrl: mockLogo("MATEUS ROSE") },
      { imageUrl: mockLogo("AVENE") },
      { imageUrl: mockLogo("CHECK-IN") },
      { imageUrl: mockLogo("PURA") },
      { imageUrl: mockLogo("RISKOS") },
      { imageUrl: mockLogo("TCHACO SPORTS") },
      { imageUrl: mockLogo("WASABI") },
      { imageUrl: mockLogo("FISIO QUINTAS") },
      { imageUrl: mockLogo("BYTE DIGITAL") },
      { imageUrl: mockLogo("LE GUSTE") },
      { imageUrl: mockLogo("URIAGE") },
      { imageUrl: mockLogo("STANDARD GESTAO") },
    ];
  }

  // Defaults caso a migration 0016 ainda não tenha sido aplicada na DB.
  // O select com colunas novas devolve undefined em vez de falhar quando
  // a column ainda não existe (depende do driver). Esta é uma defesa extra.
  type TournamentWithScenes = typeof tournament & {
    scene_main_duration_sec?: number | null;
    scene_sponsors_duration_sec?: number | null;
  };
  const t = tournament as TournamentWithScenes;
  const sceneMainSec = t.scene_main_duration_sec ?? 40;
  const sceneSponsorsSec = t.scene_sponsors_duration_sec ?? 15;

  const payload: CavaletePayload = {
    tournament: {
      name: tournament.name,
      sceneDurations: {
        mainSec: sceneMainSec,
        sponsorsSec: sceneSponsorsSec,
      },
    },
    cavalete: {
      name: totem.name,
      courts: cavaleteCourts,
    },
    liveByCourt,
    upcoming: upcomingAll.slice(0, 30),
    results: resultsAll.slice(0, 30),
    featured,
    sponsors: {
      footer: footerSponsors,
      fullscreen: fullscreenSponsors,
    },
    serverTime: new Date().toISOString(),
  };

  // 9) ETag (hash do payload sem serverTime — para 304 funcionar)
  const stableForHash = { ...payload, serverTime: undefined };
  const etag = `"${createHash("sha256")
    .update(JSON.stringify(stableForHash))
    .digest("hex")
    .slice(0, 16)}"`;

  // 10) Heartbeat
  await supabase
    .from("totems")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", totem.id);

  // 11) 304 se cliente já tem a versão actual
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

// ============================================================================
// Mock helpers — só usados quando ?demo=1 em dev/teste
// ============================================================================
function mockLiveGame(
  court: { id: string; name: string },
  a1: string,
  a2: string,
  b1: string,
  b2: string,
  startsAt: Date,
  sets: { a: number; b: number; type: "set" | "tie" }[],
): CavaletteGame {
  return {
    padelteamsId: -1 * Math.floor(Math.random() * 1e6),
    startsAt: startsAt.toISOString(),
    status: "open",
    teamA: {
      padelteamsId: -1,
      name: `${a1} / ${a2}`,
      players: [
        { padelteamsId: -1, name: a1, photoUrl: null },
        { padelteamsId: -1, name: a2, photoUrl: null },
      ],
    },
    teamB: {
      padelteamsId: -2,
      name: `${b1} / ${b2}`,
      players: [
        { padelteamsId: -1, name: b1, photoUrl: null },
        { padelteamsId: -1, name: b2, photoUrl: null },
      ],
    },
    sets,
    scoreLabel: sets.length > 0
      ? sets.map((s) => `${s.a}-${s.b}`).join(" ")
      : null,
    winner: null,
    isFeatured: false,
    court,
  };
}

function mockUpcoming(
  court: { id: string; name: string },
  a1: string,
  a2: string,
  b1: string,
  b2: string,
  startsAt: Date,
): CavaletteGame {
  return {
    padelteamsId: -1 * Math.floor(Math.random() * 1e6),
    startsAt: startsAt.toISOString(),
    status: "open",
    teamA: {
      padelteamsId: -1,
      name: `${a1} / ${a2}`,
      players: [
        { padelteamsId: -1, name: a1, photoUrl: null },
        { padelteamsId: -1, name: a2, photoUrl: null },
      ],
    },
    teamB: {
      padelteamsId: -2,
      name: `${b1} / ${b2}`,
      players: [
        { padelteamsId: -1, name: b1, photoUrl: null },
        { padelteamsId: -1, name: b2, photoUrl: null },
      ],
    },
    sets: [],
    scoreLabel: null,
    winner: null,
    isFeatured: false,
    court,
  };
}
