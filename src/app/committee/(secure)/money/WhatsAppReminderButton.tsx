"use client";

import { MessageCircle } from "lucide-react";

export function WhatsAppReminderButton({
  flatNumber,
  amountPaise,
}: {
  flatNumber: string;
  amountPaise: number;
}) {
  const rupees = (amountPaise / 100).toFixed(0);
  const text = encodeURIComponent(
    `Hello from Sapthami Heights Committee!\n\nThis is a polite reminder that Flat ${flatNumber} has an outstanding maintenance balance of ₹${rupees}.\n\nPlease clear your maintenance dues at your earliest convenience. Thank you!\n— Sapthami Heights Managing Committee`
  );

  const whatsappUrl = `https://wa.me/?text=${text}`;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded border border-positive/30 bg-positive/10 px-2 py-1 text-xs font-semibold text-positive hover:bg-positive/20"
      title={`Send WhatsApp reminder to Flat ${flatNumber}`}
    >
      <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
    </a>
  );
}
