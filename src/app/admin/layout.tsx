import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../login/actions";
import { TrophyIcon, UsersIcon, KeyIcon } from "@/components/icons";

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
    <div className="flex min-h-dvh">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-slate-800/80 bg-slate-950/80 backdrop-blur-xl lg:flex">
        <div className="px-6 py-6">
          <Link href="/admin" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="GameVision"
              className="h-10 w-auto object-contain"
            />
          </Link>
        </div>

        <nav className="flex-1 space-y-0.5 px-3">
          <SidebarLink href="/admin" icon={<TrophyIcon className="h-4 w-4" />}>
            Torneios
          </SidebarLink>
          <SidebarLink href="/admin/players" icon={<UsersIcon className="h-4 w-4" />}>
            Jogadores
          </SidebarLink>
          <SidebarLink href="/admin/users" icon={<KeyIcon className="h-4 w-4" />}>
            Utilizadores
          </SidebarLink>
        </nav>

        <div className="border-t border-slate-800/80 p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-800 text-xs font-semibold uppercase">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-slate-200">
                {displayName}
              </div>
              {user.email && displayName !== user.email && (
                <div className="truncate text-[11px] text-slate-500">
                  {user.email}
                </div>
              )}
            </div>
          </div>
          <form action={logout} className="mt-1">
            <button
              type="submit"
              className="w-full rounded-lg px-3 py-1.5 text-left text-xs text-slate-400 transition hover:bg-slate-900 hover:text-slate-100"
            >
              Terminar sessão
            </button>
          </form>
        </div>
      </aside>

      {/* Sidebar mobile (top bar fallback) */}
      <header className="sticky top-0 z-30 flex w-full items-center justify-between border-b border-slate-800 bg-slate-950/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/admin" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="GameVision" className="h-8 w-auto object-contain" />
        </Link>
        <form action={logout}>
          <button type="submit" className="text-xs text-slate-400 hover:text-slate-100">
            Sair
          </button>
        </form>
      </header>

      {/* Main */}
      <main className="flex-1 min-w-0">
        <div className="mx-auto max-w-5xl px-6 py-8 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  );
}

function SidebarLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-900 hover:text-white"
    >
      <span className="text-slate-500">{icon}</span>
      {children}
    </Link>
  );
}
