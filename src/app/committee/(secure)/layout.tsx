import { redirect } from "next/navigation";
import { getCommitteeIdentity } from "@/lib/supabase/committee";
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
  if (!identity) redirect("/committee/login");

  return (
    <div className="flex flex-1 flex-col">
      <CommitteeNav email={identity.email} role={identity.role} />
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</div>
    </div>
  );
}
