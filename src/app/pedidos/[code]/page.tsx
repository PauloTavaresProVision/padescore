import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { PedidosClient } from "./PedidosClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ code: string }>;
}

/**
 * Página PÚBLICA para jogadores submeterem pedidos de alteração de horário.
 *
 * URL: /pedidos/{competition_code}
 *
 * Fluxo:
 *   1. Página carrega só com o branding do torneio
 *   2. Componente client pede telemóvel ao jogador
 *   3. Lookup via /api/pedidos/{code}/lookup → match por nome com PadelTeams
 *   4. Mostra só os jogos do jogador identificado
 *   5. Modal para preencher motivo e submeter
 */
export default async function PedidosPage({ params }: PageProps) {
  const { code } = await params;
  if (!code || code.length < 3) notFound();

  const supabase = createAdminClient();
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, logo_url, primary_color")
    .eq("padelteams_competition_code", code)
    .maybeSingle();
  if (!tournament) notFound();

  const primaryColor = tournament.primary_color ?? "#10b981";

  return (
    <div
      className="min-h-screen px-3 py-6 sm:px-4 sm:py-10"
      style={{
        background: `linear-gradient(180deg, ${primaryColor}10, #f8fafc)`,
      }}
    >
      <div className="mx-auto max-w-md">
        <header className="mb-6 text-center">
          {tournament.logo_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={tournament.logo_url}
              alt={tournament.name}
              className="mx-auto mb-3 h-16 w-16 rounded-xl object-contain"
            />
          )}
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
            {tournament.name}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Pedidos de alteração de horário
          </p>
        </header>

        <PedidosClient competitionCode={code} />

        <p className="mt-6 text-center text-[11px] text-slate-400">
          Após submeter o pedido vais poder partilhar a info no grupo
          WhatsApp dos jogadores. O clube responde por contacto directo.
        </p>
      </div>
    </div>
  );
}
