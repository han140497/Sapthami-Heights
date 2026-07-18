import Link from "next/link";
import { Building2, ShieldCheck, Droplets, Receipt } from "lucide-react";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-fg">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Sapthami Heights</h1>
          <p className="mt-2 text-muted">
            Maintenance accounts, water charges, and issues — open to every resident.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/resident"
            className="group rounded-xl border border-border bg-surface p-6 shadow-sm transition hover:border-primary hover:shadow-md"
          >
            <Receipt className="mb-3 h-6 w-6 text-primary" />
            <h2 className="text-lg font-semibold">I&apos;m a resident</h2>
            <p className="mt-1 text-sm text-muted">
              See your dues, how your water charge was worked out, and where the society&apos;s
              money goes.
            </p>
            <span className="mt-4 inline-block text-sm font-medium text-primary group-hover:underline">
              Enter with your flat &amp; phone →
            </span>
          </Link>

          <Link
            href="/committee"
            className="group rounded-xl border border-border bg-surface p-6 shadow-sm transition hover:border-accent hover:shadow-md"
          >
            <ShieldCheck className="mb-3 h-6 w-6 text-accent" />
            <h2 className="text-lg font-semibold">I&apos;m on the committee</h2>
            <p className="mt-1 text-sm text-muted">
              Record readings and payments, run the monthly close, and keep the books.
            </p>
            <span className="mt-4 inline-block text-sm font-medium text-accent group-hover:underline">
              Committee sign in →
            </span>
          </Link>
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted">
          <Droplets className="h-4 w-4" />
          <span>
            Two blocks · 37 flats · water blended from Manjeera &amp; tankers, shown in full.
          </span>
        </div>
      </div>
    </main>
  );
}
