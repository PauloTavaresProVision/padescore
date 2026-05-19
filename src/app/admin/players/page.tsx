import { createClient } from "@/lib/supabase/server";
import { LinkButton } from "@/components/ui/Button";
import { PlusIcon } from "@/components/icons";
import { PlayerList } from "./PlayerList";

export const dynamic = "force-dynamic";

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const sp = await searchParams;

  const { data: players, error } = await supabase
    .from("players")
    .select("id, name, short_name, photo_url, mirror, created_at")
    .order("name", { ascending: true });

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Backoffice</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
            Jogadores
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-500">
            Carrega cada jogador uma vez. A IA remove o fundo no upload e a foto
            fica pronta para reutilizar em qualquer jogo.
          </p>
        </div>
        <LinkButton href="/admin/players/new" size="md">
          <PlusIcon className="h-4 w-4" />
          Novo jogador
        </LinkButton>
      </div>

      {(sp.error || error) && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {sp.error ?? error?.message}
        </div>
      )}

      <PlayerList players={players ?? []} />
    </div>
  );
}
