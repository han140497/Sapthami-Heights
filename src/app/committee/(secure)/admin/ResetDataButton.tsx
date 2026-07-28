"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui";
import { resetAllTestData } from "./actions";

export function ResetDataButton() {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onReset() {
    setError(null);
    start(async () => {
      const res = await resetAllTestData();
      if (res.ok) {
        setOpen(false);
        showToast(res.message ?? "All test data cleared.", "success");
        router.refresh();
      } else {
        setError(res.error ?? "Could not reset test data.");
        showToast(res.error ?? "Could not reset test data.", "error");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm font-semibold text-negative hover:bg-negative/20"
      >
        <RotateCcw className="h-4 w-4" /> Reset all test transactions (Fresh Start)
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-negative/40 bg-surface p-4 shadow-sm">
      <div className="flex items-center gap-2 text-negative">
        <AlertTriangle className="h-5 w-5" />
        <h4 className="font-semibold">Reset All Test Data & Ledger History?</h4>
      </div>
      <p className="mt-1 text-xs text-muted">
        This will permanently clear all sample payments, expenses, invoices, water readings, and trial balance lines.
        Flats, resident details, and committee user accounts will NOT be deleted. Use this to start 100% clean for your official handover month!
      </p>
      {error && <p className="mt-2 text-xs text-negative">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={onReset}
          disabled={pending}
          className="rounded-lg bg-negative px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Resetting…" : "Yes, Wipe All Test Data"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-3 py-2 text-xs text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
