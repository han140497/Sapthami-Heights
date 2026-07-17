import { cn } from "@/lib/utils";
import { formatPaise } from "@/lib/money";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface p-5 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "negative" | "warning";
}) {
  const toneClass = {
    default: "text-foreground",
    positive: "text-positive",
    negative: "text-negative",
    warning: "text-warning",
  }[tone];
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      <span className={cn("tabular text-2xl font-semibold", toneClass)}>{value}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </Card>
  );
}

/** Money value with a sign-aware tone: owed = negative colour, in-advance = positive. */
export function Money({
  paise,
  signed = false,
  className,
}: {
  paise: number;
  signed?: boolean;
  className?: string;
}) {
  const tone = !signed ? "" : paise > 0 ? "text-negative" : paise < 0 ? "text-positive" : "";
  return <span className={cn("tabular", tone, className)}>{formatPaise(paise)}</span>;
}

const badgeTones: Record<string, string> = {
  open: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  acknowledged: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  estimating: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  in_progress: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  resolved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  closed: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  rejected: "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  urgent: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  normal: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  low: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  verified: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  recorded: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  bounced: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export function Badge({ value, className }: { value: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        badgeTones[value] ?? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
        className,
      )}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <Card className="flex flex-col items-center gap-1 py-10 text-center">
      <p className="font-medium">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted">{hint}</p>}
    </Card>
  );
}
