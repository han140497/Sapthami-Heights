"use client";

import { useState, useTransition } from "react";
import { saveReadings } from "../actions";

export interface ReadingRow {
  flatId: string;
  flatNumber: string;
  priorReading: number | null;
  currentReading: number | null;
  consumption: number | null;
  isEstimated: boolean;
}

export function ReadingsGrid({
  periodId,
  rows: initialRows,
  disabled,
}: {
  periodId: string;
  rows: ReadingRow[];
  disabled: boolean;
}) {
  const [rows, setRows] = useState(initialRows);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function update(flatId: string, patch: Partial<ReadingRow>) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.flatId !== flatId) return r;
        const next = { ...r, ...patch };
        // When a current reading is entered, derive consumption from the prior
        // reading — unless the meter was reset, in which case consumption is typed
        // directly and we leave it alone.
        if (patch.currentReading !== undefined && next.priorReading != null && !next.isEstimated) {
          const diff = (patch.currentReading ?? 0) - next.priorReading;
          next.consumption = diff >= 0 ? diff : next.consumption;
        }
        return next;
      }),
    );
  }

  function save() {
    setMessage(null);
    const payload = rows
      .filter((r) => r.consumption != null || r.currentReading != null)
      .map((r) => ({
        flatId: r.flatId,
        consumptionLitres: r.consumption ?? 0,
        readingValue: r.currentReading ?? r.priorReading ?? 0,
        isEstimated: r.isEstimated,
      }));
    startTransition(async () => {
      const result = await saveReadings(periodId, payload);
      setMessage(result.ok ? (result.message ?? "Saved.") : (result.error ?? "Failed."));
    });
  }

  const entered = rows.filter((r) => r.consumption != null).length;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-muted">
          {entered} of {rows.length} flats have a reading
        </span>
        {!disabled && (
          <button
            onClick={save}
            disabled={pending}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save readings"}
          </button>
        )}
      </div>
      {message && <p className="mb-3 text-sm text-positive">{message}</p>}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-background text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Flat</th>
              <th className="px-3 py-2 text-right font-medium">Prior</th>
              <th className="px-3 py-2 text-right font-medium">Current reading</th>
              <th className="px-3 py-2 text-right font-medium">Consumption (L)</th>
              <th className="px-3 py-2 text-center font-medium">Est.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.flatId} className="border-t border-border">
                <td className="px-3 py-1.5 font-medium">{r.flatNumber}</td>
                <td className="px-3 py-1.5 text-right tabular text-muted">
                  {r.priorReading ?? "—"}
                </td>
                <td className="px-3 py-1.5 text-right">
                  <input
                    type="number"
                    disabled={disabled}
                    value={r.currentReading ?? ""}
                    onChange={(e) =>
                      update(r.flatId, {
                        currentReading: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    className="w-24 rounded border border-border bg-surface px-2 py-1 text-right tabular disabled:opacity-60"
                  />
                </td>
                <td className="px-3 py-1.5 text-right">
                  <input
                    type="number"
                    disabled={disabled}
                    value={r.consumption ?? ""}
                    onChange={(e) =>
                      update(r.flatId, {
                        consumption: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    className="w-24 rounded border border-border bg-surface px-2 py-1 text-right tabular disabled:opacity-60"
                  />
                </td>
                <td className="px-3 py-1.5 text-center">
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={r.isEstimated}
                    onChange={(e) => update(r.flatId, { isEstimated: e.target.checked })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
