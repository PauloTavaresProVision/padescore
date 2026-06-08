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
 * Design dark premium: hero gradient, branding forte, glassmorphism nos
 * cards. Mobile-first.
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

  const accent = tournament.primary_color ?? "#10b981";

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      {/* Glow gradients de fundo */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 60% 50% at 50% 0%, ${accent}25, transparent 60%),
            radial-gradient(ellipse 80% 50% at 50% 100%, ${accent}15, transparent 70%)
          `,
        }}
      />
      {/* Dot pattern subtil */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "radial-gradient(circle, white 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative mx-auto max-w-md px-4 py-8 sm:py-12">
        <header className="mb-8 text-center">
          {tournament.logo_url && (
            <div
              className="mx-auto mb-5 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-white/95 p-3 shadow-2xl ring-1 ring-white/20"
              style={{ boxShadow: `0 20px 60px -10px ${accent}80` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tournament.logo_url}
                alt={tournament.name}
                className="h-full w-full object-contain"
              />
            </div>
          )}
          <h1
            className="text-2xl font-black tracking-tight text-white sm:text-3xl"
            style={{ textShadow: `0 0 30px ${accent}60` }}
          >
            {tournament.name}
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-300">
            Pedidos de alteração de horário
          </p>
          <div
            className="mx-auto mt-3 h-0.5 w-16 rounded-full"
            style={{ background: accent }}
          />
        </header>

        <PedidosClient competitionCode={code} accentColor={accent} />

        <footer className="mt-8 text-center">
          <p className="text-xs leading-relaxed text-slate-500">
            Após submeter, os outros jogadores recebem SMS e podem aceitar
            no link.
            <br />O clube avalia e responde.
          </p>
        </footer>
      </div>
    </div>
  );
}
