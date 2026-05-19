"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrophyIcon, UsersIcon, KeyIcon } from "@/components/icons";

const ITEMS = [
  { href: "/admin", label: "Torneios", icon: TrophyIcon, match: ["/admin", "/admin/tournaments"] },
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
                ? "bg-lime-400/[0.12] text-white"
                : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100",
            ].join(" ")}
          >
            {active && (
              <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-lime-400 shadow-[0_0_12px_#a3e635]" />
            )}
            <Icon
              className={[
                "h-[18px] w-[18px] transition",
                active ? "text-lime-400" : "text-slate-500 group-hover:text-slate-300",
              ].join(" ")}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
