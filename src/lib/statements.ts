import "server-only";
import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db/client";
import {
  expenses,
  leases,
  ownershipSplits,
  properties,
  rentPayments,
  users,
} from "@/db/schema";
import { fwtNetTax } from "@/lib/tax/fwt";
import type { Statement, StatementLine, StatementMonth } from "@/lib/statements-render";

export { renderStatementHtml } from "@/lib/statements-render";
export type { Statement, StatementLine, StatementMonth } from "@/lib/statements-render";

// Build monthly statements for every co-owner with at least one ownership_split.
// Returns one Statement per (co-owner × month).
export async function buildStatementsForMonth(month: StatementMonth): Promise<Statement[]> {
  const start = monthIso(month.year, month.month, 1);
  const end = monthIso(
    month.month === 12 ? month.year + 1 : month.year,
    month.month === 12 ? 1 : month.month + 1,
    1,
  );

  const coOwners = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.role, "co_owner"));
  if (coOwners.length === 0) return [];

  const allProps = await db
    .select({ id: properties.id, name: properties.name })
    .from(properties);
  if (allProps.length === 0) return [];
  const propNameById = new Map(allProps.map((p) => [p.id, p.name]));

  const splits = await db
    .select({
      propertyId: ownershipSplits.propertyId,
      userId: ownershipSplits.userId,
      bps: ownershipSplits.percentageBps,
      effectiveFrom: ownershipSplits.effectiveFrom,
    })
    .from(ownershipSplits)
    .where(lt(ownershipSplits.effectiveFrom, end));

  // Latest split per (property, user) up to the cutoff.
  const latestSplit = new Map<string, number>();
  splits.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  for (const s of splits) {
    if (!s.propertyId) continue;
    latestSplit.set(`${s.propertyId}:${s.userId}`, s.bps);
  }

  const rents = await db
    .select({
      leaseId: rentPayments.leaseId,
      amountCents: rentPayments.amountCents,
      status: rentPayments.status,
    })
    .from(rentPayments)
    .where(and(gte(rentPayments.paidOn, start), lt(rentPayments.paidOn, end)));
  const allLeases = await db.select().from(leases);
  const leaseToProp = new Map(allLeases.map((l) => [l.id, l.propertyId]));

  const grossByProp = new Map<string, number>();
  for (const r of rents) {
    if (r.status !== "confirmed") continue;
    const propId = leaseToProp.get(r.leaseId);
    if (!propId) continue;
    grossByProp.set(propId, (grossByProp.get(propId) ?? 0) + r.amountCents);
  }

  const exps = await db
    .select({
      propertyId: expenses.propertyId,
      amountCents: expenses.amountCents,
      status: expenses.status,
    })
    .from(expenses)
    .where(and(gte(expenses.incurredOn, start), lt(expenses.incurredOn, end)));
  const expensesByProp = new Map<string, number>();
  for (const e of exps) {
    if (e.status !== "approved") continue;
    expensesByProp.set(e.propertyId, (expensesByProp.get(e.propertyId) ?? 0) + e.amountCents);
  }

  const out: Statement[] = [];
  for (const co of coOwners) {
    const lines: StatementLine[] = [];
    for (const p of allProps) {
      const bps = latestSplit.get(`${p.id}:${co.id}`);
      if (!bps) continue;
      const gross = grossByProp.get(p.id) ?? 0;
      const expense = expensesByProp.get(p.id) ?? 0;
      const { netTaxCents } = fwtNetTax({ grossRentCents: gross, rebateCents: 0 });
      const distributable = gross - netTaxCents - expense;
      const share = Math.round((distributable * bps) / 10000);
      lines.push({
        propertyName: propNameById.get(p.id) ?? "Property",
        grossRentCents: gross,
        netTaxCents,
        approvedExpensesCents: expense,
        distributableCents: distributable,
        shareBps: bps,
        shareCents: share,
      });
    }
    if (lines.length === 0) continue;
    out.push({
      coOwnerId: co.id,
      coOwnerName: co.name ?? co.email,
      coOwnerEmail: co.email,
      month,
      lines,
      totalShareCents: lines.reduce((s, l) => s + l.shareCents, 0),
    });
  }
  return out;
}

function monthIso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
