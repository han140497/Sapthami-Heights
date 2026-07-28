"use client";

import { useState } from "react";
import { QrCode, Copy, Check, ExternalLink } from "lucide-react";

export function UpiPaymentCard({
  flatNumber,
  amountPaise,
  vpa = "sapthami@upi",
}: {
  flatNumber: string;
  amountPaise: number;
  vpa?: string;
}) {
  const [copied, setCopied] = useState(false);

  if (amountPaise <= 0) return null;

  const rupees = (amountPaise / 100).toFixed(0);
  const upiPayload = `upi://pay?pa=${encodeURIComponent(vpa)}&pn=Sapthami%20Heights&am=${rupees}&tn=Maintenance%20Flat%20${encodeURIComponent(flatNumber)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiPayload)}`;

  function handleCopyVpa() {
    navigator.clipboard.writeText(vpa);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <div className="mb-6 rounded-2xl border border-accent/40 bg-accent/5 p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
            <QrCode className="h-3.5 w-3.5" /> Instant UPI Payment
          </div>
          <h3 className="text-lg font-bold">Pay Dues for Flat {flatNumber}</h3>
          <p className="text-xs text-muted">
            Scan QR code or click Pay Now to open GPay, PhonePe, or Paytm with pre-filled amount.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted">UPI VPA:</span>
            <code className="rounded bg-background px-2 py-1 font-mono font-semibold text-foreground border border-border">
              {vpa}
            </code>
            <button
              onClick={handleCopyVpa}
              className="flex items-center gap-1 text-accent hover:underline font-medium"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-positive" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy VPA"}
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 shrink-0">
          <div className="rounded-xl border border-border bg-white p-2 shadow-inner">
            {/* Dynamic QR Code */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="UPI QR Code" className="h-36 w-36 rounded" />
          </div>
          <a
            href={upiPayload}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-white shadow hover:opacity-90 transition-opacity"
          >
            Pay ₹{rupees} Now <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
