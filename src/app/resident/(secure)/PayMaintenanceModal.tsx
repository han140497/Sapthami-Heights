"use client";

import { useState, useTransition, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, QrCode, ExternalLink, Copy, Check, Upload, Send, FileText, Image as ImageIcon, X } from "lucide-react";
import { useToast } from "@/components/ui";
import { paiseToRupeeInput, formatPaise } from "@/lib/money";
import { submitResidentPaymentClaim } from "../actions";

export function PayMaintenanceModal({
  flatNumber,
  amountPaise,
  vpa = "sapthami@upi",
}: {
  flatNumber: string;
  amountPaise: number;
  vpa?: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [receiptData, setReceiptData] = useState<string | null>(null);
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const today = new Date().toISOString().slice(0, 10);
  const rupees = amountPaise > 0 ? (amountPaise / 100).toFixed(0) : "0";
  const upiPayload = `upi://pay?pa=${encodeURIComponent(vpa)}&pn=Sapthami%20Heights&am=${rupees}&tn=Maintenance%20Flat%20${encodeURIComponent(flatNumber)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiPayload)}`;

  function handleCopyVpa() {
    navigator.clipboard.writeText(vpa);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("File size must be under 5MB.");
      return;
    }

    setReceiptFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      setReceiptData(evt.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  function onSubmit(formData: FormData) {
    setError(null);
    start(async () => {
      if (receiptData) {
        formData.append("receiptData", receiptData);
      }
      const res = await submitResidentPaymentClaim(null, formData);
      if (res.ok) {
        setOpen(false);
        showToast(res.message ?? "Payment notice sent to committee!", "success");
        router.refresh();
      } else {
        setError(res.error ?? "Could not submit payment notice.");
        showToast(res.error ?? "Could not submit payment notice.", "error");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white shadow hover:opacity-90 transition-opacity"
      >
        <CreditCard className="h-4 w-4" /> Pay Maintenance
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-2xl text-left">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 rounded-full p-1.5 text-muted hover:bg-background hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-4">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                <QrCode className="h-3.5 w-3.5" /> Maintenance Payment
              </div>
              <h2 className="mt-1 text-xl font-bold">Pay Dues for Flat {flatNumber}</h2>
              <p className="text-xs text-muted">
                Scan QR or tap GPay to pay, then submit your payment notice with one click.
              </p>
            </div>

            {/* Step 1: Pay Section */}
            <div className="mb-5 rounded-xl border border-accent/30 bg-accent/5 p-4">
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
                <div className="space-y-1">
                  <div className="text-xs text-muted font-medium">Amount Due:</div>
                  <div className="text-2xl font-black text-accent">{formatPaise(amountPaise)}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs">
                    <span className="text-muted">VPA:</span>
                    <code className="rounded bg-background px-1.5 py-0.5 font-mono font-semibold">{vpa}</code>
                    <button onClick={handleCopyVpa} className="text-accent hover:underline font-medium flex items-center gap-0.5">
                      {copied ? <Check className="h-3 w-3 text-positive" /> : <Copy className="h-3 w-3" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="rounded-lg bg-white p-1.5 shadow">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrUrl} alt="UPI QR Code" className="h-28 w-28 rounded" />
                  </div>
                  <a
                    href={upiPayload}
                    className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white shadow hover:opacity-90"
                  >
                    Pay ₹{rupees} via GPay / PhonePe <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* Step 2: Report Payment Form */}
            <form action={onSubmit} className="space-y-3">
              <h3 className="text-sm font-semibold border-t border-border pt-3">Submit Payment Proof &amp; Notice</h3>
              
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs font-medium">
                  Amount Paid (₹)
                  <input
                    name="amount"
                    required
                    defaultValue={paiseToRupeeInput(amountPaise > 0 ? amountPaise : 0)}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>

                <label className="flex flex-col gap-1 text-xs font-medium">
                  Payment Date
                  <input
                    name="paidOn"
                    type="date"
                    required
                    defaultValue={today}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>

                <label className="flex flex-col gap-1 text-xs font-medium">
                  Payment Mode
                  <select name="mode" defaultValue="upi" className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
                    <option value="bank">Bank Transfer (NEFT / IMPS)</option>
                    <option value="cash">Cash given to Committee</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-xs font-medium">
                  Ref / UTR No. (Optional)
                  <input
                    name="reference"
                    placeholder="Optional reference"
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
              </div>

              {/* Upload Screenshot / PDF Proof */}
              <div className="flex flex-col gap-1 text-xs font-medium">
                <span>Attach Payment Screenshot / PDF Proof (Optional)</span>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background/50 p-3 hover:bg-background">
                  <Upload className="h-4 w-4 text-muted" />
                  <span className="text-xs text-muted">
                    {receiptFileName ? receiptFileName : "Upload GPay screenshot or PDF receipt"}
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {receiptData && (
                <div className="flex items-center gap-2 text-xs text-positive font-medium">
                  {receiptData.startsWith("data:image") ? (
                    <ImageIcon className="h-4 w-4" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  <span>Payment proof attached: {receiptFileName}</span>
                </div>
              )}

              {error && <p className="text-xs text-negative">{error}</p>}

              <div className="mt-4 flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white shadow hover:opacity-90 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" /> {pending ? "Sending Notice…" : "I Have Paid — Notify Committee"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-sm text-muted hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
