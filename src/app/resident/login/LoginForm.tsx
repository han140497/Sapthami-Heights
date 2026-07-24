"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface FlatOption {
  number: string;
  blockCode: string;
}

export function LoginForm({ flats }: { flats: FlatOption[] }) {
  const router = useRouter();
  const [block, setBlock] = useState("");
  const [flatNumber, setFlatNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const blocks = Array.from(new Set(flats.map((f) => f.blockCode))).sort();
  const flatsInBlock = flats.filter((f) => f.blockCode === block).map((f) => f.number);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/resident/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ block, flatNumber, phone }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Sign in failed. Please try again.");
        setSubmitting(false);
        return;
      }
      router.push("/resident");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="block">
          Block
        </label>
        <select
          id="block"
          value={block}
          onChange={(e) => {
            setBlock(e.target.value);
            setFlatNumber("");
          }}
          required
          className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
        >
          <option value="">Select block…</option>
          {blocks.map((b) => (
            <option key={b} value={b}>
              Block {b}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="flat">
          Flat
        </label>
        <select
          id="flat"
          value={flatNumber}
          onChange={(e) => setFlatNumber(e.target.value)}
          required
          disabled={!block}
          className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm disabled:opacity-50"
        >
          <option value="">{block ? "Select flat…" : "Choose a block first"}</option>
          {flatsInBlock.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="phone">
          Registered phone number
        </label>
        <input
          id="phone"
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="10-digit mobile number"
          required
          className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
        />
        <p className="text-xs text-muted">
          The number the committee has on file for this flat. Ask them if you&apos;re not sure.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-negative dark:bg-red-950/40">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || !block || !flatNumber || !phone}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-fg transition hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Checking…" : "View my flat"}
      </button>
    </form>
  );
}
