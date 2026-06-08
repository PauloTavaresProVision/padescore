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

  // Chave estável que muda quando sponsors mudam (count, ids ou order).
  // Usada no src do iframe para forçar reload após CRUD.
  const previewKey = sponsors
    .map((s) => `${s.id.slice(0, 8)}-${s.sortOrder}`)
    .join("_");

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
      <p className="mt-1 mb-4 max-w-2xl text-sm text-slate-500">
        Logótipos que aparecem nos cavaletes do torneio.{" "}
        <b className="text-slate-700">Fullscreen</b> = patrocinador oficial
        (cartão grande, centro da cena).{" "}
        <b className="text-slate-700">Footer</b> = parceiros oficiais
        (4 cartões pequenos 2×2 no rodapé da cena).
      </p>
      <div className="mb-6 grid max-w-3xl gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-xs text-slate-700">
          <div className="mb-1 font-bold text-emerald-700">
            FULLSCREEN — Patrocinador Oficial
          </div>
          <div>
            Recomendado: <b>800×300 px</b> · Máximo: 900×400 px
          </div>
          <div>Ideal: PNG transparente ou SVG</div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 text-xs text-slate-700">
          <div className="mb-1 font-bold text-blue-700">
            FOOTER — Parceiros Oficiais
          </div>
          <div>
            Recomendado: <b>300×200 px</b> · Máximo: 350×250 px
          </div>
          <div>Ideal: PNG transparente ou SVG · margem à volta do logo</div>
        </div>
      </div>

      {sp.error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {sp.error}
        </div>
      )}

      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="lg:flex-1">
          <SponsorsManager
            tournamentId={tournamentId}
            initialSponsors={sponsors}
          />
        </div>
        <aside className="lg:w-[230px]">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            Preview do totem
          </h2>
          <p className="mb-3 text-xs text-slate-500">
            Os sponsors abaixo aparecem em rotação no rodapé. Jogadores e
            horário são exemplo — só os sponsors são os reais deste torneio.
          </p>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-sm">
            <iframe
              title="Preview do totem"
              src={`/totem-preview/${tournamentId}?v=${encodeURIComponent(previewKey)}`}
              width="192"
              height="640"
              style={{ display: "block", border: 0, width: 192, height: 640 }}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
