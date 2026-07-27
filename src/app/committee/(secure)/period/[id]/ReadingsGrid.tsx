"use client";

import { useState, useTransition } from "react";
import { Upload } from "lucide-react";
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
        if (patch.currentReading !== undefined && next.priorReading != null && !next.isEstimated) {
          const diff = (patch.currentReading ?? 0) - next.priorReading;
          next.consumption = diff >= 0 ? diff : next.consumption;
        }
        return next;
      }),
    );
  }

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/);
      let count = 0;

      setRows((prev) => {
        const nextRows = [...prev];
        for (const line of lines) {
          if (!line.trim()) continue;
          const parts = line.split(/[,;\t]+/).map((p) => p.trim());
          if (parts.length < 2) continue;

          const rawFlat = parts[0].toUpperCase().replace(/\s+/g, "");
          const rawVal = Number(parts[1].replace(/[^0-9.]/g, ""));
          if (isNaN(rawVal)) continue;

          const targetIndex = nextRows.findIndex((r) => {
            const num = r.flatNumber.toUpperCase().replace(/[^A-Z0-9]/g, "");
            const search = rawFlat.replace(/[^A-Z0-9]/g, "");
            return num === search;
          });

          if (targetIndex >= 0) {
            const r = nextRows[targetIndex];
            const updated = { ...r, currentReading: rawVal };
            if (updated.priorReading != null && !updated.isEstimated) {
              const diff = rawVal - updated.priorReading;
              updated.consumption = diff >= 0 ? diff : rawVal;
            } else {
              updated.consumption = rawVal;
            }
            nextRows[targetIndex] = updated;
            count++;
          }
        }
        return nextRows;
      });

      setMessage(`Imported readings for ${count} flats from CSV. Don't forget to click "Save readings".`);
      e.target.value = "";
    };
    reader.readAsText(file);
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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted">
          {entered} of {rows.length} flats have a reading
        </span>
        {!disabled && (
          <div className="flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:bg-background">
              <Upload className="h-4 w-4 text-muted" />
              <span>Import CSV</span>
              <input type="file" accept=".csv,.txt" onChange={handleCsvUpload} className="hidden" />
            </label>
            <button
              onClick={save}
              disabled={pending}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save readings"}
            </button>
          </div>
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
