import { redirect } from "next/navigation";
import { getResidentSession } from "@/lib/auth/resident";
import { ResidentNav } from "../ResidentNav";

export const dynamic = "force-dynamic";

export default async function SecureResidentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getResidentSession();
  if (!session) redirect("/resident/login");

  return (
    <div className="flex flex-1 flex-col">
      <ResidentNav flatNumber={session.flatNumber} />
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">{children}</div>
    </div>
  );
}
