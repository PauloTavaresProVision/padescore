import { login, signup } from "./actions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; info?: string; mode?: string }>;
}) {
  const sp = await searchParams;
  const isSignup = sp.mode === "signup";

  return (
    <div className="relative grid min-h-dvh w-full lg:grid-cols-2">
      {/* Decoração à esquerda (só em desktop) */}
      <div className="relative hidden overflow-hidden bg-slate-950 lg:block">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-cyan-500/10" />
        <div className="absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />

        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-3 text-xl font-semibold tracking-tight">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-slate-950 shadow-lg shadow-emerald-500/20">
              P
            </span>
            Padescore
          </div>

          <div className="max-w-md">
            <h2 className="text-4xl font-bold leading-tight tracking-tight">
              Scoring profissional<br />
              <span className="text-slate-400">para o teu torneio.</span>
            </h2>
            <p className="mt-4 text-base text-slate-400">
              Backoffice, marcador mobile e overlay para transmissão — tudo
              sincronizado em tempo real.
            </p>

            <ul className="mt-10 space-y-3 text-sm text-slate-300">
              <Feature>Golden point ou vantagens, configurável por jogo</Feature>
              <Feature>Até 4 courts em simultâneo</Feature>
              <Feature>Overlay transparente para OBS em qualquer URL</Feature>
              <Feature>Undo fiável — eventos append-only</Feature>
            </ul>
          </div>

          <div className="text-xs text-slate-600">
            Powered by Next.js · Supabase · Realtime
          </div>
        </div>
      </div>

      {/* Form à direita */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Brand mobile only */}
          <div className="mb-10 flex items-center gap-2 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 text-slate-950">
              P
            </span>
            <span className="text-lg font-semibold tracking-tight">Padescore</span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight">
            {isSignup ? "Criar conta" : "Bem-vindo de volta"}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {isSignup
              ? "Cria a tua conta de administrador para começar."
              : "Entra no backoffice para gerir torneios e jogos."}
          </p>

          {sp.error && (
            <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {sp.error}
            </div>
          )}
          {sp.info && (
            <div className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              {sp.info}
            </div>
          )}

          <form action={isSignup ? signup : login} className="mt-8 space-y-5">
            <input type="hidden" name="next" value={sp.next ?? "/admin"} />

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-200">
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="tu@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-200">
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete={isSignup ? "new-password" : "current-password"}
                placeholder="••••••••"
              />
            </div>

            <Button type="submit" size="lg" className="w-full">
              {isSignup ? "Criar conta" : "Entrar"}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500">
            {isSignup ? (
              <>
                Já tens conta?{" "}
                <a href="/login" className="font-medium text-emerald-400 hover:text-emerald-300">
                  Entrar
                </a>
              </>
            ) : (
              <>
                Primeira vez?{" "}
                <a href="/login?mode=signup" className="font-medium text-emerald-400 hover:text-emerald-300">
                  Criar conta
                </a>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
      <span>{children}</span>
    </li>
  );
}
