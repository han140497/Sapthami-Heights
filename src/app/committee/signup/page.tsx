import Link from "next/link";
import { redirect } from "next/navigation";
import { getCommitteeIdentity } from "@/lib/supabase/committee";
import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";

export default async function CommitteeSignupPage() {
  let identity = null;
  try {
    identity = await getCommitteeIdentity();
  } catch {
    // ignore
  }
  if (identity) redirect("/committee");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 inline-block text-sm text-muted hover:underline">
          ← Sapthami Heights
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Request committee access</h1>
        <p className="mt-1 mb-6 text-sm text-muted">
          Create an account, then a committee admin approves you and assigns your role. You won&apos;t be
          able to see anything until you&apos;re approved. Residents don&apos;t need this.
        </p>
        <SignupForm />
      </div>
    </main>
  );
}
