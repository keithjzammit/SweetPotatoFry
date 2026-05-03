import Link from "next/link";
import { requireUser } from "@/auth/server";
import type { Role } from "@/auth/server";

type NavItem = { href: string; label: string };

const NAV: Record<Role, NavItem[]> = {
  owner: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/properties", label: "Properties" },
    { href: "/tax", label: "Tax" },
    { href: "/people", label: "People" },
    { href: "/settings", label: "Settings" },
  ],
  co_owner: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/properties", label: "Properties" },
    { href: "/settings", label: "Settings" },
  ],
  manager: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/properties", label: "Properties" },
    { href: "/settings", label: "Settings" },
  ],
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const items = NAV[user.role];
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
            SweetPotatoFry
          </Link>
          <nav className="hidden items-center gap-4 text-sm md:flex">
            {items.map((it) => (
              <Link key={it.href} href={it.href} className="text-muted-foreground hover:text-foreground">
                {it.label}
              </Link>
            ))}
            <form action="/auth/sign-out" method="post">
              <button
                type="submit"
                className="text-muted-foreground hover:text-foreground"
              >
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t bg-background md:hidden">
        {items.slice(0, 4).map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className="flex h-16 items-center justify-center text-xs text-muted-foreground"
          >
            {it.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
