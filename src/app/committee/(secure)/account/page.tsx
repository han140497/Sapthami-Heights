import { getCommitteeIdentity } from "@/lib/supabase/committee";
import { PageHeader, Card } from "@/components/ui";
import { ChangePasswordForm } from "./AccountClient";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const identity = await getCommitteeIdentity();
  if (!identity) return null;

  return (
    <>
      <PageHeader title="My account" subtitle="Your committee login and password." />

      <Card className="mb-6 max-w-sm">
        <dl className="grid grid-cols-[auto,1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted">Email</dt>
          <dd className="font-medium">{identity.email}</dd>
          <dt className="text-muted">Role</dt>
          <dd className="font-medium capitalize">{identity.role}</dd>
        </dl>
      </Card>

      <h2 className="mb-3 text-sm font-semibold">Change your password</h2>
      <ChangePasswordForm />
    </>
  );
}
