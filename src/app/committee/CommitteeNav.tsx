"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShieldCheck, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBrowserClient } from "@/lib/supabase/browser";

const links = [
  { href: "/committee", label: "Dashboard" },
  { href: "/committee/period", label: "Periods" },
  { href: "/committee/money", label: "Money" },
  { href: "/committee/issues", label: "Issues" },
  { href: "/committee/books", label: "Books" },
  { href: "/committee/admin", label: "Admin" },
];

export function CommitteeNav({ email, role }: { email: string | null; role: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    try {
      await getBrowserClient().auth.signOut();
    } catch {
      // ignore
    }
    router.push("/committee/login");
    router.refresh();
  }

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-accent" />
          <span className="font-semibold">Committee</span>
          <span className="ml-1 rounded-md bg-accent/10 px-2 py-0.5 text-xs font-medium capitalize text-accent">
            {role}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted sm:inline">{email}</span>
          <button onClick={logout} className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
      <nav className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-2 sm:px-4">
        {links.map((link) => {
          const active =
            link.href === "/committee" ? pathname === "/committee" : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "border-accent text-accent"
                  : "border-transparent text-muted hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
