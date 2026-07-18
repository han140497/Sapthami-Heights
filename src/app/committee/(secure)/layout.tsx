import { redirect } from "next/navigation";
import { getCommitteeIdentity, getCommitteeAuthUser } from "@/lib/supabase/committee";
import { CommitteeNav } from "../CommitteeNav";

export const dynamic = "force-dynamic";

export default async function SecureCommitteeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let identity = null;
  try {
    identity = await getCommitteeIdentity();
  } catch {
    identity = null;
  }
  if (!identity) {
    // Signed in but not yet approved onto the committee → pending page, not a login
    // loop. Genuinely signed out → login.
    const user = await getCommitteeAuthUser();
    redirect(user ? "/committee/pending" : "/committee/login");
  }

  return (
    <div className="flex flex-1 flex-col">
      <CommitteeNav email={identity.email} role={identity.role} />
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</div>
    </div>
  );
}
