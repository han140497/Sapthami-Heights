"use client";

import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/browser";

export function SignOutButton({ className, label = "Sign out" }: { className?: string; label?: string }) {
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
    <button onClick={logout} className={className}>
      {label}
    </button>
  );
}
