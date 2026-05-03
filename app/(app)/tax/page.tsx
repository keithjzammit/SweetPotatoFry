import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db/client";
import {
  expenses,
  leases,
  properties,
  rentPayments,
  taxElections,
} from "@/db/schema";
import { requireRole } from "@/auth/server";
import { Currency } from "@/components/currency";
import { fwtNetTax } from "@/lib/tax/fwt";
import { Button } from "@/components/ui/button";
import { TaxElectionForm } from "./election-form";

export default async function TaxPage() {
  const owner = await requireRole(["owner"]);
  const year = new Date().getUTCFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year + 1}-01-01`;

  // Current election (defaults to FWT_15)
  const election = (
    await db
      .select()
      .from(taxElections)
      .where(and(eq(taxElections.ownerId, owner.id), eq(taxElections.taxYear, year)))
      .limit(1)
  )[0];

  // Sum confirmed rent in the year across owner's properties.
  const myProps = await db
    .select({ id: properties.id })
    .from(properties)
    .where(eq(properties.ownerId, owner.id));
  const propIds = myProps.map((p) => p.id);

  let grossCents = 0;
  let approvedExpenseCents = 0;

  if (propIds.length > 0) {
    const rents = await db
      .select({ amountCents: rentPayments.amountCents, status: rentPayments.status, leaseId: rentPayments.leaseId })
      .from(rentPayments)
      .where(and(gte(rentPayments.paidOn, yearStart), lt(rentPayments.paidOn, yearEnd)));
    const myLeaseIds = new Set(
      (
        await db
          .select({ id: leases.id })
          .from(leases)
          .where(and(gte(leases.startDate, "1900-01-01")))
      ).map((l) => l.id),
    );
    for (const r of rents) {
      if (r.status === "confirmed" && myLeaseIds.has(r.leaseId)) {
        grossCents += r.amountCents;
      }
    }

    const exps = await db
      .select({ amountCents: expenses.amountCents, status: expenses.status, propertyId: expenses.propertyId })
      .from(expenses)
      .where(
        and(
          gte(expenses.incurredOn, yearStart),
          lt(expenses.incurredOn, yearEnd),
        ),
      );
    for (const e of exps) {
      if (e.status === "approved" && propIds.includes(e.propertyId)) {
        approvedExpenseCents += e.amountCents;
      }
    }
  }

  const fwt = fwtNetTax({ grossRentCents: grossCents, rebateCents: 0 });

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Tax · {year}</h1>
        <p className="text-sm text-muted-foreground">
          Election applies to all your properties for the year.
        </p>
      </header>

      <TaxElectionForm
        year={year}
        currentElection={election?.election ?? "FWT_15"}
      />

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">P&amp;L estimate (FWT, no rebate)</h2>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted-foreground">Gross rent received</dt>
          <dd>
            <Currency cents={grossCents} />
          </dd>
          <dt className="text-muted-foreground">FWT 15% (before rebate)</dt>
          <dd>
            <Currency cents={fwt.fwtCents} />
          </dd>
          <dt className="text-muted-foreground">Expenses logged (approved)</dt>
          <dd>
            <Currency cents={approvedExpenseCents} />
          </dd>
          <dt className="text-muted-foreground">Distributable (gross − tax − expenses)</dt>
          <dd className="font-medium">
            <Currency cents={grossCents - fwt.fwtCents - approvedExpenseCents} />
          </dd>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Per-property rebates are applied in the TA24 export below.
        </p>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">TA24 export</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Per-property breakdown with rebate and per-owner share.
        </p>
        <a href={`/api/ta24/${year}`} className="mt-3 inline-block">
          <Button>Download TA24 {year} CSV</Button>
        </a>
      </section>
    </section>
  );
}
