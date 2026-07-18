import Link from "next/link";
import { redirect } from "next/navigation";
import { getCommitteeIdentity, getCommitteeAuthUser } from "@/lib/supabase/committee";
import { SignOutButton } from "../SignOutButton";

export const dynamic = "force-dynamic";

export default async function CommitteePendingPage() {
  // Already approved → straight to the app. Not signed in at all → login.
  let identity = null;
  try {
    identity = await getCommitteeIdentity();
  } catch {
    // ignore
  }
  if (identity) redirect("/committee");
  const user = await getCommitteeAuthUser();
  if (!user) redirect("/committee/login");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Awaiting approval</h1>
        <p className="mt-3 text-sm text-muted">
          You&apos;re signed in as <span className="font-medium text-foreground">{user.email}</span>, but a
          committee admin hasn&apos;t approved your access yet. Once they assign you a role, you&apos;ll be able
          to sign in and use the committee tools.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <SignOutButton className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface" />
          <Link href="/" className="text-sm text-muted hover:underline">← Back to home</Link>
        </div>
      </div>
    </main>
  );
}
