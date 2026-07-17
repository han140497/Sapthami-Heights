"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteWaterPurchase } from "../actions";

export function DeletePurchaseButton({ periodId, purchaseId }: { periodId: string; purchaseId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() =>
        start(async () => {
          await deleteWaterPurchase(periodId, purchaseId);
          router.refresh();
        })
      }
      disabled={pending}
      className="text-muted hover:text-negative disabled:opacity-50"
      aria-label="Delete purchase"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
