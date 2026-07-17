import Link from "next/link";
import { redirect } from "next/navigation";
import { getCommitteeIdentity } from "@/lib/supabase/committee";
import { CommitteeLoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function CommitteeLoginPage() {
  let identity = null;
  try {
    identity = await getCommitteeIdentity();
  } catch {
    // Supabase not configured yet — show the form, which will explain.
  }
  if (identity) redirect("/committee");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 inline-block text-sm text-muted hover:underline">
          ← Sapthami Heights
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Committee sign in</h1>
        <p className="mt-1 mb-6 text-sm text-muted">
          For committee members only. Residents don&apos;t need this — use the resident entrance.
        </p>
        <CommitteeLoginForm />
      </div>
    </main>
  );
}
