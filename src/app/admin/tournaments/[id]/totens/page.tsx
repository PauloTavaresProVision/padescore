import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ChevronLeftIcon } from "@/components/icons";
import { TotensTable } from "./TotensTable";

export const dynamic = "force-dynamic";

export default async function TotensPage({
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

  const [{ data: courts }, { data: totems }] = await Promise.all([
    supabase
      .from("courts")
      .select("id, name, sort_order")
      .eq("tournament_id", tournamentId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("totems")
      .select("id, court_id, name, api_token, last_seen_at, created_at")
      .eq("tournament_id", tournamentId),
  ]);

  // Determinar a base URL para construir as URLs da API que o user copia.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;

  // Index de totem por court_id
  const totemByCourt = new Map(
    (totems ?? []).map((t) => [t.court_id, t] as const),
  );
  const rows = (courts ?? []).map((c) => {
    const t = totemByCourt.get(c.id) ?? null;
    return {
      court: { id: c.id, name: c.name },
      totem: t
        ? {
            id: t.id,
            name: t.name,
            apiToken: t.api_token,
            apiUrl: `${baseUrl}/api/totem/${t.api_token}`,
            lastSeenAt: t.last_seen_at,
          }
        : null,
    };
  });

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
        Totens
      </h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Cada totem corresponde a um campo. Cria um totem por campo, copia o
        URL da API e cola na app Windows do totem. O token é secreto — quem
        tiver acesso ao URL consegue ver os jogos do campo.
      </p>

      {sp.error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {sp.error}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-8 text-center">
          <p className="text-sm text-amber-900">
            Ainda não tens campos definidos. Cria os campos primeiro em{" "}
            <Link
              href={`/admin/tournaments/${tournamentId}`}
              className="font-semibold underline"
            >
              página do torneio
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
          <TotensTable tournamentId={tournamentId} rows={rows} />
        </div>
      )}
    </div>
  );
}
