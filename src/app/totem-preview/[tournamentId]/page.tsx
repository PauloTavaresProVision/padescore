import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  MainScene,
  Stage,
  type TotemPayload,
} from "../../totem/[token]/TotemView";

export const dynamic = "force-dynamic";

/**
 * Rota de PREVIEW para uso interno do admin (embedded via iframe na página
 * de sponsors). Renderiza o totem usando os SPONSORS REAIS deste torneio
 * mas com dados mock para jogadores/horário — útil para validar a ordem do
 * carousel antes de qualquer totem físico estar online.
 *
 * Autenticação: só o owner do torneio (igual ao restante /admin).
 */
export default async function TotemPreviewPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, owner_id")
    .eq("id", tournamentId)
    .single();
  if (!tournament) notFound();
  if (tournament.owner_id !== user.id) redirect("/admin");

  const { data: sponsorsRaw } = await supabase
    .from("tournament_sponsors")
    .select("image_url, kind, duration_sec, sort_order")
    .eq("tournament_id", tournamentId)
    .order("kind", { ascending: true })
    .order("sort_order", { ascending: true });

  const allSponsors = sponsorsRaw ?? [];
  const footer = allSponsors
    .filter((s) => s.kind === "footer")
    .map((s) => ({ imageUrl: s.image_url }));
  const fullscreen = allSponsors
    .filter((s) => s.kind === "fullscreen")
    .map((s) => ({
      imageUrl: s.image_url,
      durationSec: s.duration_sec,
    }));

  // Mock match data — só os sponsors são reais
  const scheduledAt = new Date();
  scheduledAt.setHours(18, 0, 0, 0);

  const mock: TotemPayload = {
    tournament: {
      name: tournament.name,
      logoUrl: null,
      primaryColor: "#2d8cff",
    },
    court: "CAMPO 1",
    currentMatch: {
      id: "preview-current",
      status: "scheduled",
      scheduledAt: scheduledAt.toISOString(),
      teamA: {
        p1: {
          name: "Carlos Sousa",
          shortName: "CARLOS SOUSA",
          photoUrl: null,
        },
        p2: {
          name: "Sergio Vieira",
          shortName: "SERGIO VIEIRA",
          photoUrl: null,
        },
      },
      teamB: {
        p1: { name: "Nicolau M.", shortName: "NICOLAU M.", photoUrl: null },
        p2: { name: "Wojtek D.", shortName: "WOJTEK D.", photoUrl: null },
      },
    },
    nextMatch: {
      id: "preview-next",
      status: "scheduled",
      scheduledAt: null,
      teamA: {
        p1: { name: "Diogo M", shortName: "DIOGO M", photoUrl: null },
        p2: { name: "Manuel P", shortName: "MANUEL P", photoUrl: null },
      },
      teamB: {
        p1: { name: "Miguel R", shortName: "MIGUEL R", photoUrl: null },
        p2: { name: "Tomás G", shortName: "TOMÁS G", photoUrl: null },
      },
    },
    sponsors: { footer, fullscreen },
    serverTime: new Date().toISOString(),
  };

  return (
    <Stage>
      <MainScene data={mock} />
    </Stage>
  );
}
