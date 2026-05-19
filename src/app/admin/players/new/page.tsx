import Link from "next/link";
import { ChevronLeftIcon } from "@/components/icons";
import { NewPlayerForm } from "./NewPlayerForm";

export default async function NewPlayerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/admin/players"
        className="inline-flex items-center gap-1 text-sm text-slate-400 transition hover:text-slate-200"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Voltar
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Novo jogador</h1>
      <p className="mt-1 text-sm text-slate-400">
        Carrega uma foto individual. A IA remove o fundo automaticamente. O nome
        curto serve para o scoreboard OBS, o nome completo para a TV.
      </p>

      {sp.error && (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {sp.error}
        </div>
      )}

      <NewPlayerForm />
    </div>
  );
}
