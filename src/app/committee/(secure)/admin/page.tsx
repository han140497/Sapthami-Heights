import { getServiceClient } from "@/lib/supabase/admin";
import { getCommitteeIdentity } from "@/lib/supabase/committee";
import { Card, PageHeader, Badge } from "@/components/ui";
import { ResidentForm } from "./ResidentForm";
import { ResidentActions, ResidentItem } from "./ResidentActions";
import { FlatsManager } from "./FlatsManager";
import { AccountsManager } from "./AccountsManager";
import { CommitteeManager } from "./CommitteeManager";
import { PendingApprovals } from "./PendingApprovals";
import { VehiclesManager } from "./VehiclesManager";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = getServiceClient();
  const identity = await getCommitteeIdentity();
  const isAdmin = identity?.role === "admin";

  // --- Flats + active residents (owner & tenant; resident registration open to committee) ---
  const { data: flats } = await admin
    .from("flats")
    .select("id, number, floor, flat_type, is_active, blocks(code), flat_residents(id, is_primary, to_date, role, resident_id, residents(id, name, phone, email))")
    .order("number");

  const flatRows = (flats ?? []).map((f) => {
    const activeResidents: ResidentItem[] = ((f.flat_residents as unknown as {
      id: string;
      is_primary: boolean;
      to_date: string | null;
      role: string;
      resident_id: string;
      residents: { id: string; name: string; phone: string; email: string | null } | null;
    }[]) ?? [])
      .filter((fr) => fr.to_date == null && fr.residents != null)
      .map((fr) => ({
        linkId: fr.id,
        residentId: fr.resident_id,
        name: fr.residents!.name,
        phone: fr.residents!.phone,
        email: fr.residents!.email ?? null,
        role: fr.role,
        isPrimary: fr.is_primary,
      }));

    return {
      id: f.id as string,
      number: f.number as string,
      floor: f.floor as string,
      blockCode: (f.blocks as unknown as { code: string })?.code ?? "",
      type: f.flat_type as string,
      isActive: f.is_active as boolean,
      residents: activeResidents,
    };
  });

  const activeFlats = flatRows.filter((r) => r.isActive);
  const withResident = activeFlats.filter((r) => r.residents.length > 0).length;
  const flatOptions = activeFlats.map((r) => ({ id: r.id, number: r.number }));

  // --- Vehicles across the society (committee-wide view) ---
  const { data: vehicleData } = await admin
    .from("vehicles")
    .select("id, vehicle_type, registration_number, make_model, parking_slot, flats(number)")
    .eq("is_active", true)
    .order("registration_number");
  const vehicleRows = (vehicleData ?? []).map((v) => ({
    id: v.id as string,
    flatNumber: (v.flats as unknown as { number: string })?.number ?? "—",
    vehicle_type: v.vehicle_type as string,
    registration_number: v.registration_number as string,
    make_model: (v.make_model as string | null) ?? null,
    parking_slot: (v.parking_slot as string | null) ?? null,
  }));

  // --- Admin-only data ---
  let accountRows: { id: string; code: string; name: string; type: string; isActive: boolean; inUse: boolean }[] = [];
  let committeeRows: { id: string; userId: string; email: string; role: string; fromDate: string }[] = [];
  let pendingRows: { userId: string; email: string; signedUpAt: string }[] = [];

  if (isAdmin) {
    const { data: accounts } = await admin.from("accounts").select("id, code, name, type, is_active").order("code");
    const { data: usedRaw } = await admin.from("journal_lines").select("account_id");
    const used = new Set((usedRaw ?? []).map((r) => r.account_id as string));
    accountRows = (accounts ?? []).map((a) => ({
      id: a.id as string,
      code: a.code as string,
      name: a.name as string,
      type: a.type as string,
      isActive: a.is_active as boolean,
      inUse: used.has(a.id as string),
    }));

    const { data: members } = await admin
      .from("committee_members")
      .select("id, user_id, role, from_date")
      .is("to_date", null)
      .order("from_date");
    const { data: userList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const emailById = new Map((userList?.users ?? []).map((u) => [u.id, u.email ?? "(no email)"]));
    committeeRows = (members ?? []).map((m) => ({
      id: m.id as string,
      userId: m.user_id as string,
      email: emailById.get(m.user_id as string) ?? "(unknown)",
      role: m.role as string,
      fromDate: m.from_date as string,
    }));

    const { data: everMembers } = await admin.from("committee_members").select("user_id");
    const everMemberIds = new Set((everMembers ?? []).map((m) => m.user_id as string));
    pendingRows = (userList?.users ?? [])
      .filter((u) => !everMemberIds.has(u.id))
      .map((u) => ({
        userId: u.id,
        email: u.email ?? "(no email)",
        signedUpAt: (u.created_at ?? "").slice(0, 10),
      }));
  }

  return (
    <>
      <PageHeader
        title="Admin"
        subtitle={
          isAdmin
            ? `Full control of the society. ${withResident} of ${activeFlats.length} flats have registered resident(s) who can log in.`
            : `${withResident} of ${activeFlats.length} flats have registered resident(s) who can log in.`
        }
      >
        <ResidentForm flats={flatOptions} />
      </PageHeader>

      {/* Resident logins — support both Owner and Tenant per flat */}
      <Card className="overflow-x-auto p-0">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">Registered Resident Logins</div>
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b border-border bg-surface text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Flat</th>
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-left font-medium">Registered residents</th>
                <th className="px-4 py-2 text-left font-medium">Login status</th>
              </tr>
            </thead>
            <tbody>
              {activeFlats.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-medium">{r.number}</td>
                  <td className="px-4 py-2.5 capitalize text-muted">{r.type}</td>
                  <td className="px-4 py-2.5">
                    {r.residents.length > 0 ? (
                      <div className="space-y-2">
                        {r.residents.map((res) => (
                          <div key={res.residentId} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-1.5 last:border-0 last:pb-0">
                            <div>
                              <span className="font-medium text-foreground">{res.name}</span>
                              <span className="ml-2 rounded bg-background px-1.5 py-0.5 text-xs font-semibold capitalize text-muted">
                                {res.role}
                              </span>
                              <span className="ml-2 font-mono text-xs text-muted">{res.phone}</span>
                            </div>
                            <ResidentActions flatId={r.id} flatNumber={r.number} resident={res} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted">— No resident added —</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.residents.length > 0 ? <Badge value="verified" /> : <Badge value="open" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <VehiclesManager vehicles={vehicleRows} flats={flatOptions} />

      {isAdmin ? (
        <>
          <PendingApprovals pending={pendingRows} />
          <CommitteeManager members={committeeRows} currentUserEmail={identity?.email ?? null} />
          <FlatsManager flats={flatRows} />
          <AccountsManager accounts={accountRows} />
        </>
      ) : (
        <Card className="mt-4 border-dashed">
          <p className="text-sm text-muted">
            Managing flats, the chart of accounts, and committee roles requires the{" "}
            <span className="font-medium text-foreground">Admin</span> role. Ask an admin if you need changes here.
          </p>
        </Card>
      )}
    </>
  );
}
