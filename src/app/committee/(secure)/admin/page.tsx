import { getServiceClient } from "@/lib/supabase/admin";
import { getCommitteeIdentity } from "@/lib/supabase/committee";
import { Card, PageHeader, Badge } from "@/components/ui";
import { ResidentForm } from "./ResidentForm";
import { RemoveResidentButton } from "./RemoveResidentButton";
import { FlatsManager } from "./FlatsManager";
import { AccountsManager } from "./AccountsManager";
import { CommitteeManager } from "./CommitteeManager";
import { VehiclesManager } from "./VehiclesManager";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = getServiceClient();
  const identity = await getCommitteeIdentity();
  const isAdmin = identity?.role === "admin";

  // --- Flats + primary residents (resident registration is open to all committee) ---
  const { data: flats } = await admin
    .from("flats")
    .select("id, number, floor, flat_type, is_active, blocks(code), flat_residents(is_primary, to_date, role, residents(name, phone))")
    .order("number");

  const flatRows = (flats ?? []).map((f) => {
    const primary = (f.flat_residents as unknown as {
      is_primary: boolean;
      to_date: string | null;
      role: string;
      residents: { name: string; phone: string } | null;
    }[])?.find((fr) => fr.is_primary && fr.to_date == null);
    return {
      id: f.id as string,
      number: f.number as string,
      floor: f.floor as string,
      blockCode: (f.blocks as unknown as { code: string })?.code ?? "",
      type: f.flat_type as string,
      isActive: f.is_active as boolean,
      resident: primary?.residents ?? null,
      role: primary?.role,
    };
  });

  const activeFlats = flatRows.filter((r) => r.isActive);
  const withResident = activeFlats.filter((r) => r.resident).length;
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
  let committeeRows: { id: string; email: string; role: string; fromDate: string }[] = [];

  if (isAdmin) {
    const { data: accounts } = await admin.from("accounts").select("id, code, name, type, is_active").order("code");
    // Which accounts have ledger lines (so the UI can show delete vs deactivate).
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
      email: emailById.get(m.user_id as string) ?? "(unknown)",
      role: m.role as string,
      fromDate: m.from_date as string,
    }));
  }

  return (
    <>
      <PageHeader
        title="Admin"
        subtitle={
          isAdmin
            ? `Full control of the society. ${withResident} of ${activeFlats.length} flats have a resident who can log in.`
            : `${withResident} of ${activeFlats.length} flats have a registered resident who can log in.`
        }
      >
        <ResidentForm flats={flatOptions} />
      </PageHeader>

      {/* Resident logins — every committee member can manage these. */}
      <Card className="p-0">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">Resident logins</div>
        <div className="max-h-[22rem] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b border-border bg-surface text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Flat</th>
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-left font-medium">Primary resident</th>
                <th className="px-4 py-2 text-left font-medium">Phone (login)</th>
                <th className="px-4 py-2 text-left font-medium">Login?</th>
                <th className="px-4 py-2 text-right font-medium">Manage</th>
              </tr>
            </thead>
            <tbody>
              {activeFlats.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-medium">{r.number}</td>
                  <td className="px-4 py-2.5 capitalize text-muted">{r.type}</td>
                  <td className="px-4 py-2.5">
                    {r.resident?.name ?? <span className="text-muted">—</span>}
                    {r.role && <span className="ml-2 text-xs capitalize text-muted">({r.role})</span>}
                  </td>
                  <td className="px-4 py-2.5 tabular text-muted">{r.resident?.phone ?? "—"}</td>
                  <td className="px-4 py-2.5">{r.resident ? <Badge value="verified" /> : <Badge value="open" />}</td>
                  <td className="px-4 py-2.5 text-right">
                    {r.resident ? (
                      <RemoveResidentButton flatId={r.id} flatNumber={r.number} />
                    ) : (
                      <span className="text-muted">—</span>
                    )}
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
