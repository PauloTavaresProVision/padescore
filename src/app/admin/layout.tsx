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
    <div className="flex min-h-dvh bg-[#f4f5f9] text-slate-900">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-[256px] shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="px-5 py-6">
          <Link href="/admin" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="GameVision" className="h-11 w-auto object-contain" />
          </Link>
        </div>

        <Nav />

        <div className="p-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-lime-400 to-emerald-500 text-xs font-extrabold text-slate-900">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-slate-900">{displayName}</div>
                {user.email && displayName !== user.email && (
                  <div className="truncate text-[11px] text-slate-500">{user.email}</div>
                )}
              </div>
            </div>
            <form action={logout} className="mt-2.5">
              <button
                type="submit"
                className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-500 transition hover:bg-red-50 hover:text-red-600"
              >
                Terminar sessão
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Topbar mobile */}
      <header className="sticky top-0 z-30 flex w-full items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <Link href="/admin" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="GameVision" className="h-8 w-auto object-contain" />
        </Link>
        <form action={logout}>
          <button type="submit" className="text-xs font-semibold text-slate-500 hover:text-slate-900">
            Sair
          </button>
        </form>
      </header>

      {/* Main */}
      <main className="flex-1 min-w-0">
        <div className="mx-auto max-w-6xl px-6 py-9 lg:px-10">{children}</div>
      </main>
    </div>
  );
}
