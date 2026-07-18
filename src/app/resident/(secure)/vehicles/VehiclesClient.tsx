"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Car, Plus, Trash2, X } from "lucide-react";
import { addMyVehicle, removeMyVehicle } from "./actions";

type Vehicle = {
  id: string;
  vehicle_type: string;
  registration_number: string;
  make_model: string | null;
  color: string | null;
  parking_slot: string | null;
};

const TYPES = ["car", "bike", "scooter", "bicycle", "other"] as const;

export function VehiclesClient({ vehicles }: { vehicles: Vehicle[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function add(formData: FormData) {
    setError(null);
    setNotice(null);
    start(async () => {
      const r = await addMyVehicle(null, formData);
      if (r.ok) {
        setOpen(false);
        setNotice(r.message ?? null);
        router.refresh();
      } else setError(r.error ?? "Could not add the vehicle.");
    });
  }

  function remove(id: string, reg: string) {
    if (!confirm(`Remove ${reg} from your flat?`)) return;
    setError(null);
    setNotice(null);
    start(async () => {
      const r = await removeMyVehicle(id);
      if (r.ok) {
        setNotice(r.message ?? null);
        router.refresh();
      } else setError(r.error ?? "Could not remove the vehicle.");
    });
  }

  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-muted">{vehicles.length} registered</span>
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90">
          <Plus className="h-4 w-4" /> Add vehicle
        </button>
      </div>

      {open && (
        <form action={add} className="mb-4 rounded-xl border border-border bg-surface p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              Type
              <select name="vehicleType" className="rounded-lg border border-border bg-background px-3 py-2 text-sm capitalize">
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Registration number
              <input name="registrationNumber" required placeholder="TS09AB1234" className="rounded-lg border border-border bg-background px-3 py-2 text-sm uppercase" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Make &amp; model (optional)
              <input name="makeModel" placeholder="Maruti Swift" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Colour (optional)
              <input name="color" placeholder="White" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Parking slot (optional)
              <input name="parkingSlot" placeholder="P-12" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
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
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
          <Car className="mx-auto mb-2 h-6 w-6 opacity-60" />
          No vehicles registered yet. Add your car or two-wheeler so the society has a record for parking and security.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {vehicles.map((v) => (
            <div key={v.id} className="flex items-start justify-between rounded-xl border border-border bg-surface p-4">
              <div>
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-accent" />
                  <span className="font-semibold tabular">{v.registration_number}</span>
                </div>
                <div className="mt-1 text-sm capitalize text-muted">
                  {v.vehicle_type}
                  {v.make_model && ` · ${v.make_model}`}
                  {v.color && ` · ${v.color}`}
                </div>
                {v.parking_slot && <div className="mt-0.5 text-xs text-muted">Parking: {v.parking_slot}</div>}
              </div>
              <button onClick={() => remove(v.id, v.registration_number)} disabled={pending} className="text-negative hover:opacity-80 disabled:opacity-50" aria-label="Remove">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
