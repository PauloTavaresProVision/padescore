"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutIcon, UsersIcon, KeyIcon } from "@/components/icons";

const ITEMS = [
  { href: "/admin", label: "Painel", icon: LayoutIcon, match: ["/admin", "/admin/tournaments"] },
  { href: "/admin/players", label: "Jogadores", icon: UsersIcon, match: ["/admin/players"] },
  { href: "/admin/users", label: "Utilizadores", icon: KeyIcon, match: ["/admin/users"] },
];

function isActive(path: string, item: (typeof ITEMS)[number]) {
  if (item.href === "/admin") {
    return path === "/admin" || path.startsWith("/admin/tournaments");
  }
  return item.match.some((m) => path === m || path.startsWith(m + "/"));
}

export function Nav() {
  const path = usePathname() ?? "/admin";
  return (
    <nav className="flex-1 space-y-1 px-3">
      {ITEMS.map((item) => {
        const active = isActive(path, item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition",
              active
                ? "bg-emerald-50 text-emerald-700"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
            ].join(" ")}
          >
            {active && (
              <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-emerald-500" />
            )}
            <Icon
              className={[
                "h-[18px] w-[18px] transition",
                active ? "text-emerald-600" : "text-slate-400 group-hover:text-slate-600",
              ].join(" ")}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
