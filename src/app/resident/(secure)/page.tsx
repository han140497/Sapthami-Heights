import { getResidentSession } from "@/lib/auth/resident";
import {
  getFlatBalance,
  getFlatInvoices,
  getFlatPayments,
  getInvoiceLines,
} from "@/lib/db/queries";
import { Card, Money, PageHeader, StatTile, EmptyState, Badge } from "@/components/ui";
import { formatPaise } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function MyFlatPage() {
  const session = await getResidentSession();
  if (!session) return null;

  const [balance, invoices, payments] = await Promise.all([
    getFlatBalance(session.flatId),
    getFlatInvoices(session.flatId),
    getFlatPayments(session.flatId),
  ]);

  const owed = balance?.balance_paise ?? 0;
  const latest = invoices[0];
  const latestLines = latest ? await getInvoiceLines(latest.id) : [];

  return (
    <>
      <PageHeader
        title={`Flat ${session.flatNumber}`}
        subtitle="Your maintenance account with the society."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label={owed > 0 ? "Amount due" : owed < 0 ? "In advance" : "All settled"}
          value={formatPaise(Math.abs(owed))}
          tone={owed > 0 ? "negative" : owed < 0 ? "positive" : "positive"}
          hint={owed > 0 ? "Please clear at your earliest." : owed < 0 ? "Carried to next month." : "Nothing outstanding."}
        />
        <StatTile label="Total billed" value={formatPaise(balance?.billed_paise ?? 0)} hint="Since records began" />
        <StatTile label="Total paid" value={formatPaise(balance?.paid_paise ?? 0)} hint="Received & verified" />
      </div>

      {latest && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">
            Latest bill — {latest.invoice_no}
          </h2>
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <tbody>
                {latestLines.map((line) => (
                  <tr key={line.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{line.description}</div>
                      {line.kind === "water" && line.qty != null && (
                        <div className="text-xs text-muted">
                          {line.qty} litres × blended rate
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Money paise={line.amount_paise} />
                    </td>
                  </tr>
                ))}
                <tr className="bg-background/50 font-semibold">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right tabular">
                    {formatPaise(latest.total_paise)}
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>
        </section>
      )}

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-semibold">All bills</h2>
          {invoices.length === 0 ? (
            <EmptyState title="No bills yet" hint="Your first bill appears after the committee closes a month." />
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">{inv.invoice_no}</td>
                      <td className="px-4 py-3 text-muted">{inv.issued_on}</td>
                      <td className="px-4 py-3 text-right tabular">{formatPaise(inv.total_paise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold">Payments received</h2>
          {payments.length === 0 ? (
            <EmptyState title="No payments recorded yet" />
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium capitalize">{p.mode}</div>
                        <div className="text-xs text-muted">{p.paid_on}{p.reference ? ` · ${p.reference}` : ""}</div>
                      </td>
                      <td className="px-4 py-3"><Badge value={p.status} /></td>
                      <td className="px-4 py-3 text-right tabular">{formatPaise(p.amount_paise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      </section>
    </>
  );
}
