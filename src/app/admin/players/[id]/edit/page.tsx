import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChevronLeftIcon } from "@/components/icons";
import { EditPlayerForm } from "./EditPlayerForm";

export const dynamic = "force-dynamic";

export default async function EditPlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const supabase = await createClient();
  const { data: player } = await supabase
    .from("players")
    .select("id, name, short_name, photo_url, mirror")
    .eq("id", id)
    .single();

  if (!player) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/admin/players"
        className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-900"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Voltar
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">Editar jogador</h1>
      <p className="mt-1 text-sm text-slate-500">
        Muda o nome, espelhamento, ou substitui a foto. Se não carregares uma
        foto nova, a actual mantém-se.
      </p>

      {sp.error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {sp.error}
        </div>
      )}

      <EditPlayerForm player={player} />
    </div>
  );
}
