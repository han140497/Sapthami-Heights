import Link from "next/link";
import { redirect } from "next/navigation";
import { getResidentSession } from "@/lib/auth/resident";
import { getFlats } from "@/lib/db/queries";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function ResidentLoginPage() {
  if (await getResidentSession()) redirect("/resident");

  let flats: { number: string; blockCode: string }[] = [];
  let dbError = false;
  try {
    const rows = await getFlats();
    flats = rows.map((f) => ({
      number: f.number as string,
      blockCode: (f as { blocks?: { code?: string } }).blocks?.code ?? f.number.charAt(0),
    }));
  } catch {
    dbError = true;
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 inline-block text-sm text-muted hover:underline">
          ← Sapthami Heights
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Resident sign in</h1>
        <p className="mt-1 mb-6 text-sm text-muted">
          No password needed — just your flat and the phone number registered for it.
        </p>

        {dbError ? (
          <p className="rounded-lg bg-amber-50 px-3 py-3 text-sm text-warning dark:bg-amber-950/40">
            The database isn&apos;t connected yet. Once Supabase is configured, your flat list
            will appear here.
          </p>
        ) : (
          <LoginForm flats={flats} />
        )}
      </div>
    </main>
  );
}
