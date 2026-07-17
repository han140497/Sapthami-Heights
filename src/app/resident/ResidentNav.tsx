"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/resident", label: "My flat" },
  { href: "/resident/water", label: "My water" },
  { href: "/resident/society", label: "Society" },
  { href: "/resident/issues", label: "Issues" },
];

export function ResidentNav({ flatNumber }: { flatNumber: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/resident/session", { method: "DELETE" });
    router.push("/resident/login");
    router.refresh();
  }

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <span className="font-semibold">Sapthami Heights</span>
          <span className="ml-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {flatNumber}
          </span>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
      <nav className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto px-2 sm:px-4">
        {links.map((link) => {
          const active =
            link.href === "/resident"
              ? pathname === "/resident"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "border-primary text-primary"
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
