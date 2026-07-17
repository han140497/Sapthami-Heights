import { getServiceClient } from "@/lib/supabase/admin";
import { Card, PageHeader, Badge } from "@/components/ui";
import { ResidentForm } from "./ResidentForm";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = getServiceClient();
  const { data: flats } = await admin
    .from("flats")
    .select("id, number, floor, flat_type, blocks(code), flat_residents(is_primary, to_date, role, residents(name, phone))")
    .eq("is_active", true)
    .order("number");

  const rows = (flats ?? []).map((f) => {
    const primary = (f.flat_residents as unknown as {
      is_primary: boolean;
      to_date: string | null;
      role: string;
      residents: { name: string; phone: string } | null;
    }[])?.find((fr) => fr.is_primary && fr.to_date == null);
    return {
      id: f.id as string,
      number: f.number as string,
      type: f.flat_type as string,
      resident: primary?.residents ?? null,
      role: primary?.role,
    };
  });

  const withResident = rows.filter((r) => r.resident).length;
  const flatOptions = rows.map((r) => ({ id: r.id, number: r.number }));

  return (
    <>
      <PageHeader
        title="Admin"
        subtitle={`${withResident} of ${rows.length} flats have a registered resident who can log in.`}
      >
        <ResidentForm flats={flatOptions} />
      </PageHeader>

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Flat</th>
              <th className="px-4 py-2 text-left font-medium">Type</th>
              <th className="px-4 py-2 text-left font-medium">Primary resident</th>
              <th className="px-4 py-2 text-left font-medium">Phone (login)</th>
              <th className="px-4 py-2 text-left font-medium">Can log in?</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 font-medium">{r.number}</td>
                <td className="px-4 py-2.5 capitalize text-muted">{r.type}</td>
                <td className="px-4 py-2.5">
                  {r.resident?.name ?? <span className="text-muted">—</span>}
                  {r.role && <span className="ml-2 text-xs capitalize text-muted">({r.role})</span>}
                </td>
                <td className="px-4 py-2.5 tabular text-muted">{r.resident?.phone ?? "—"}</td>
                <td className="px-4 py-2.5">
                  {r.resident ? <Badge value="verified" /> : <Badge value="open" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
