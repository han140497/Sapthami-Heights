import { getResidentSession } from "@/lib/auth/resident";
import { getServiceClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/ui";
import { VehiclesClient } from "./VehiclesClient";

export const dynamic = "force-dynamic";

export default async function MyVehiclesPage() {
  const session = await getResidentSession();
  if (!session) return null;

  const { data } = await getServiceClient()
    .from("vehicles")
    .select("id, vehicle_type, registration_number, make_model, color, parking_slot")
    .eq("flat_id", session.flatId)
    .eq("is_active", true)
    .order("created_at");

  return (
    <>
      <PageHeader
        title="My vehicles"
        subtitle={`Vehicles registered to flat ${session.flatNumber}, for parking and society security.`}
      />
      <VehiclesClient vehicles={data ?? []} />
    </>
  );
}
