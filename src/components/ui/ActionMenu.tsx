"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { MoreVertical, MoreHorizontal } from "lucide-react";

export interface ActionMenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  tone?: "default" | "positive" | "negative" | "warning";
  disabled?: boolean;
  dividerBefore?: boolean;
}

export function ActionMenu({
  items,
  variant = "vertical",
}: {
  items: ActionMenuItem[];
  variant?: "vertical" | "horizontal";
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-background hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30"
        aria-label="Actions"
      >
        {variant === "vertical" ? (
          <MoreVertical className="h-4 w-4" />
        ) : (
          <MoreHorizontal className="h-4 w-4" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 min-w-[160px] origin-top-right rounded-2xl border border-border bg-surface/95 p-1.5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95">
          {items.map((item, idx) => (
            <div key={idx}>
              {item.dividerBefore && (
                <div className="my-1 border-t border-border/60" />
              )}
              <button
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-40 ${
                  item.tone === "negative"
                    ? "text-negative hover:bg-negative/10"
                    : item.tone === "positive"
                    ? "text-positive hover:bg-positive/10"
                    : item.tone === "warning"
                    ? "text-warning hover:bg-warning/10"
                    : "text-foreground hover:bg-background"
                }`}
              >
                {item.icon && <span className="h-4 w-4 shrink-0">{item.icon}</span>}
                <span>{item.label}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
