import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { leases, rentPayments } from "@/db/schema";
import { requirePropertyAccess } from "@/auth/server";
import { Currency } from "@/components/currency";
import { FormattedDate } from "@/components/date";
import { Button } from "@/components/ui/button";

export default async function RentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePropertyAccess(id);

  const activeLease = (
    await db
      .select()
      .from(leases)
      .where(and(eq(leases.propertyId, id), isNull(leases.endDate)))
      .limit(1)
  )[0];

  const items = activeLease
    ? await db
        .select()
        .from(rentPayments)
        .where(eq(rentPayments.leaseId, activeLease.id))
        .orderBy(desc(rentPayments.paidOn))
        .limit(120)
    : [];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Rent</h1>
        {activeLease && (
          <Link href={`/properties/${id}/rent/new`}>
            <Button size="sm">Log rent</Button>
          </Link>
        )}
      </div>
      {!activeLease ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          No active lease. Create one to log rent.
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          No rent logged yet.
        </div>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {items.map((it) => (
            <li key={it.id} className="grid grid-cols-[1fr_auto] gap-2 px-4 py-3">
              <div>
                <div className="text-sm">
                  <FormattedDate value={it.periodStart} /> –{" "}
                  <FormattedDate value={it.periodEnd} />
                </div>
                <div className="text-xs text-muted-foreground">
                  Paid <FormattedDate value={it.paidOn} /> · {it.status}
                </div>
              </div>
              <Currency cents={it.amountCents} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
