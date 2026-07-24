"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui";
import { formatPaise, paiseToRupeeInput } from "@/lib/money";
import { editWaterPurchase, deleteWaterPurchase } from "../actions";

type Purchase = {
  id: string;
  source_type: string;
  litres: number;
  amount_paise: number;
  purchased_on: string;
  vendor: string | null;
};

export function PurchasesList({
  periodId,
  purchases,
  editable,
}: {
  periodId: string;
  purchases: Purchase[];
  editable: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const total = purchases.reduce((a, p) => a + p.amount_paise, 0);

  function save(formData: FormData) {
    setError(null);
    start(async () => {
      const r = await editWaterPurchase(null, formData);
      if (r.ok) {
        setEditing(null);
        router.refresh();
      } else setError(r.error ?? "Could not update.");
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this delivery?")) return;
    setError(null);
    start(async () => {
      const r = await deleteWaterPurchase(periodId, id);
      if (r.ok) router.refresh();
      else setError(r.error ?? "Could not delete.");
    });
  }

  if (purchases.length === 0) return null;

  return (
    <div className="mb-3 overflow-x-auto rounded-xl border border-border bg-surface">
      {error && <p className="border-b border-border px-4 py-2 text-sm text-negative">{error}</p>}
      <table className="w-full text-sm">
        <thead className="border-b border-border text-xs uppercase text-muted">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Source</th>
            <th className="px-4 py-2 text-left font-medium">Date</th>
            <th className="px-4 py-2 text-right font-medium">Litres</th>
            <th className="px-4 py-2 text-left font-medium">Vendor</th>
            <th className="px-4 py-2 text-right font-medium">Amount</th>
            {editable && <th className="px-2 py-2" />}
          </tr>
        </thead>
        <tbody>
          {purchases.map((p) =>
            editing === p.id ? (
              <tr key={p.id} className="border-b border-border last:border-0 bg-background/40">
                <td className="px-4 py-2" colSpan={editable ? 6 : 5}>
                  <form action={save} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="purchaseId" value={p.id} />
                    <input type="hidden" name="periodId" value={periodId} />
                    <label className="flex flex-col gap-1 text-xs">
                      Date
                      <input name="purchasedOn" type="date" defaultValue={p.purchased_on} required className="rounded-md border border-border bg-background px-2 py-1 text-sm" />
                    </label>
                    <label className="flex flex-col gap-1 text-xs">
                      Litres
                      <input name="litres" type="number" min={1} defaultValue={p.litres} required className="w-28 rounded-md border border-border bg-background px-2 py-1 text-sm" />
                    </label>
                    <label className="flex flex-col gap-1 text-xs">
                      Amount (₹)
                      <input name="amount" defaultValue={paiseToRupeeInput(p.amount_paise)} required className="w-28 rounded-md border border-border bg-background px-2 py-1 text-sm" />
                    </label>
                    <label className="flex flex-col gap-1 text-xs">
                      Vendor
                      <input name="vendor" defaultValue={p.vendor ?? ""} className="rounded-md border border-border bg-background px-2 py-1 text-sm" />
                    </label>
                    <button type="submit" disabled={pending} className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Save</button>
                    <button type="button" onClick={() => setEditing(null)} className="px-2 py-1.5 text-xs text-muted">Cancel</button>
                  </form>
                </td>
              </tr>
            ) : (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5"><Badge value={p.source_type} /></td>
                <td className="px-4 py-2.5 tabular text-muted">{p.purchased_on}</td>
                <td className="px-4 py-2.5 text-right tabular">{(p.litres / 1000).toLocaleString("en-IN")} KL</td>
                <td className="px-4 py-2.5 text-muted">{p.vendor ?? "—"}</td>
                <td className="px-4 py-2.5 text-right tabular">{formatPaise(p.amount_paise)}</td>
                {editable && (
                  <td className="px-2 py-2.5">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditing(p.id)} disabled={pending} className="text-muted hover:text-foreground disabled:opacity-50" aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => remove(p.id)} disabled={pending} className="text-negative hover:opacity-80 disabled:opacity-50" aria-label="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ),
          )}
          <tr className="bg-background/50 font-semibold">
            <td className="px-4 py-2.5" colSpan={4}>Total spent on water</td>
            <td className="px-4 py-2.5 text-right tabular">{formatPaise(total)}</td>
            {editable && <td />}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
