import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChevronLeftIcon } from "@/components/icons";
import { SponsorsManager, type SponsorRow } from "./SponsorsManager";

export const dynamic = "force-dynamic";

export default async function SponsorsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id: tournamentId } = await params;
  const sp = await searchParams;
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
    .select("id, image_url, kind, duration_sec, sort_order")
    .eq("tournament_id", tournamentId)
    .order("kind", { ascending: true })
    .order("sort_order", { ascending: true });

  const sponsors: SponsorRow[] = (sponsorsRaw ?? []).map((s) => ({
    id: s.id,
    imageUrl: s.image_url,
    kind: s.kind as "footer" | "fullscreen",
    durationSec: s.duration_sec,
    sortOrder: s.sort_order,
  }));

  return (
    <div>
      <Link
        href={`/admin/tournaments/${tournamentId}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-900"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Voltar ao torneio
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">
        Sponsors
      </h1>
      <p className="mt-1 mb-6 max-w-2xl text-sm text-slate-500">
        Imagens que aparecem no totem dos campos.{" "}
        <b className="text-slate-700">Footer</b> = logos pequenos sempre
        visíveis no rodapé.{" "}
        <b className="text-slate-700">Fullscreen</b> = imagens grandes
        rotativas (entre conteúdo do jogo).
      </p>

      {sp.error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {sp.error}
        </div>
      )}

      <SponsorsManager tournamentId={tournamentId} initialSponsors={sponsors} />
    </div>
  );
}
