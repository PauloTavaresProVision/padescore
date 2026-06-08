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

  // Procura primeiro cavalete deste torneio — necessário porque o preview
  // re-aproveita a rota /cavalete/{token} (já tem o renderer da Cena 3).
  // Se não houver cavalete configurado, mostramos hint para criar um.
  const { data: firstCavalete } = await supabase
    .from("totems")
    .select("api_token")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

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
        <b className="text-slate-700">Fullscreen</b> = Patrocinadores Oficiais
        (até 8 logos juntos num cartão grande 4×2).{" "}
        <b className="text-slate-700">Footer</b> = Parceiros (6 caixinhas
        em grid 3×2, rotacionam entre todos os parceiros disponíveis).
      </p>
      <div className="mb-6 grid max-w-3xl gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-xs text-slate-700">
          <div className="mb-1 font-bold text-emerald-700">
            FULLSCREEN — Patrocinadores Oficiais (até 8)
          </div>
          <div>
            Recomendado: <b>200×120 px</b> · Máximo: 300×180 px
          </div>
          <div>
            Todos visíveis ao mesmo tempo num grid 4 colunas × 2 linhas.
          </div>
          <div>Ideal: PNG transparente ou SVG · sem fundo branco</div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 text-xs text-slate-700">
          <div className="mb-1 font-bold text-blue-700">
            FOOTER — Parceiros (sem limite)
          </div>
          <div>
            Recomendado: <b>240×180 px</b> · Máximo: 320×240 px
          </div>
          <div>
            6 caixinhas em grid 3×2 rotacionam entre todos os parceiros
            (8s por slot).
          </div>
          <div>Ideal: PNG transparente ou SVG</div>
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
        <aside className="lg:w-[270px]">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            Preview do cavalete (Cena Sponsors)
          </h2>
          <p className="mb-3 text-xs text-slate-500">
            Mostra como os sponsors aparecem no cavalete 1080×1920 (Cena 3).
            Jogadores são exemplo — sponsors são os reais deste torneio.
          </p>
          {firstCavalete?.api_token ? (
            <div
              className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-sm"
              style={{ width: 270, height: 480 }}
            >
              <iframe
                title="Preview cavalete — Cena Sponsors"
                src={`/cavalete/${firstCavalete.api_token}?scene=sponsors&preview=1&v=${encodeURIComponent(previewKey)}`}
                style={{
                  display: "block",
                  border: 0,
                  // Renderiza a 1080×1920 e escala para o iframe via CSS
                  width: 1080,
                  height: 1920,
                  transform: "scale(0.25)",
                  transformOrigin: "top left",
                }}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <b className="block mb-1">Sem cavalete configurado</b>
              Cria um cavalete na secção{" "}
              <Link
                href={`/admin/tournaments/${tournamentId}/totens`}
                className="font-bold underline"
              >
                Cavaletes
              </Link>{" "}
              deste torneio para ver o preview aqui.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
