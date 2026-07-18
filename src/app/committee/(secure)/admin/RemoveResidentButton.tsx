"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { removePrimaryResident } from "./actions";

export function RemoveResidentButton({ flatId, flatNumber }: { flatId: string; flatNumber: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onClick() {
    if (!confirm(`Remove the registered resident from ${flatNumber}? The flat will not be able to log in until a new resident is set.`)) return;
    start(async () => {
      const r = await removePrimaryResident(flatId);
      if (!r.ok) alert(r.error ?? "Could not remove the resident.");
      router.refresh();
    });
  }

  return (
    <button onClick={onClick} disabled={pending} className="text-sm text-negative hover:underline disabled:opacity-50">
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
