"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Car, X, Trash2 } from "lucide-react";
import { ActionMenu } from "@/components/ui";
import { addVehicleForFlat, removeVehicleAsAdmin } from "./actions";

const TYPES = ["car", "bike", "scooter", "bicycle", "other"] as const;

type Vehicle = {
  id: string;
  flatNumber: string;
  vehicle_type: string;
  registration_number: string;
  make_model: string | null;
  parking_slot: string | null;
};

export function VehiclesManager({
  vehicles,
  flats,
}: {
  vehicles: Vehicle[];
  flats: { id: string; number: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, onOk?: () => void) {
    setError(null);
    setNotice(null);
    start(async () => {
      const r = await fn();
      if (r.ok) {
        setNotice(r.message ?? null);
        onOk?.();
        router.refresh();
      } else setError(r.error ?? "Something went wrong.");
    });
  }

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Vehicles ({vehicles.length})</h2>
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          <Car className="h-4 w-4" /> Add vehicle
        </button>
      </div>

      {open && (
        <form action={(fd) => run(() => addVehicleForFlat(null, fd), () => setOpen(false))} className="mb-3 rounded-xl border border-border bg-surface p-4">
          <div className="grid gap-3 sm:grid-cols-5">
            <label className="flex flex-col gap-1 text-sm">
              Flat
              <select name="flatId" required className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="">Select…</option>
                {flats.map((f) => <option key={f.id} value={f.id}>{f.number}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Type
              <select name="vehicleType" className="rounded-lg border border-border bg-background px-3 py-2 text-sm capitalize">
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Registration
              <input name="registrationNumber" required placeholder="TS09AB1234" className="rounded-lg border border-border bg-background px-3 py-2 text-sm uppercase" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Make/model (opt)
              <input name="makeModel" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Parking slot (opt)
              <input name="parkingSlot" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </label>
          </div>
          <button type="submit" disabled={pending} className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {pending ? "Adding…" : "Add vehicle"}
          </button>
        </form>
      )}

      {notice && (
        <div className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-accent/40 bg-accent/5 px-3 py-2 text-sm">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-muted hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
      )}
      {error && <p className="mb-3 text-sm text-negative">{error}</p>}

      {vehicles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
          No vehicles registered across the society yet.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface">
          <div className="max-h-[26rem] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b border-border bg-surface text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Flat</th>
                  <th className="px-4 py-2 text-left font-medium">Registration</th>
                  <th className="px-4 py-2 text-left font-medium">Type</th>
                  <th className="px-4 py-2 text-left font-medium">Details</th>
                  <th className="px-4 py-2 text-left font-medium">Slot</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr key={v.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 font-medium">{v.flatNumber}</td>
                    <td className="px-4 py-2.5 tabular">{v.registration_number}</td>
                    <td className="px-4 py-2.5 capitalize text-muted">{v.vehicle_type}</td>
                    <td className="px-4 py-2.5 text-muted">{v.make_model ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted">{v.parking_slot ?? "—"}</td>
                    <td className="px-2 py-2.5 text-right">
                      <ActionMenu
                        items={[
                          {
                            label: "Remove Vehicle",
                            icon: <Trash2 className="h-3.5 w-3.5" />,
                            onClick: () => {
                              if (confirm(`Remove ${v.registration_number}?`)) {
                                run(() => removeVehicleAsAdmin(v.id));
                              }
                            },
                            tone: "negative",
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
