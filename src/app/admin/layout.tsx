import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../login/actions";
import { Nav } from "./Nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const displayName =
    (user.user_metadata?.name as string | undefined) ||
    (user.user_metadata?.full_name as string | undefined) ||
    user.email ||
    "Utilizador";
  const initials = displayName.trim().slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-dvh bg-[#0a0c12] text-slate-100">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-[256px] shrink-0 flex-col border-r border-white/[0.06] bg-[#0c0e15] lg:flex">
        <div className="px-5 py-6">
          <Link href="/admin" className="block">
            {/* O logo já contém o lettering "Game vision" — sem texto extra. */}
            <span className="inline-grid place-items-center rounded-2xl bg-white px-3 py-2 shadow-lg shadow-black/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="GameVision" className="h-10 w-auto object-contain" />
            </span>
          </Link>
        </div>

        <Nav />

        <div className="p-3">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-lime-400 to-emerald-500 text-xs font-extrabold text-slate-950">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{displayName}</div>
                {user.email && displayName !== user.email && (
                  <div className="truncate text-[11px] text-slate-500">{user.email}</div>
                )}
              </div>
            </div>
            <form action={logout} className="mt-2.5">
              <button
                type="submit"
                className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-500 transition hover:bg-red-500/10 hover:text-red-300"
              >
                Terminar sessão
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Topbar mobile */}
      <header className="sticky top-0 z-30 flex w-full items-center justify-between border-b border-white/[0.06] bg-[#0c0e15]/95 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/admin" className="flex items-center">
          <span className="inline-grid place-items-center rounded-xl bg-white px-2 py-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="GameVision" className="h-7 w-auto object-contain" />
          </span>
        </Link>
        <form action={logout}>
          <button type="submit" className="text-xs font-semibold text-slate-400 hover:text-slate-100">
            Sair
          </button>
        </form>
      </header>

      {/* Main */}
      <main className="relative flex-1 min-w-0 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(900px 500px at 85% -10%, rgba(163,230,53,0.06), transparent 60%), radial-gradient(700px 500px at 0% 110%, rgba(56,189,248,0.05), transparent 55%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 py-10 lg:px-12">
          {children}
        </div>
      </main>
    </div>
  );
}
