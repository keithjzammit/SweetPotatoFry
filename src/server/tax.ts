"use server";
import "server-only";
import { and, asc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { db } from "@/db/client";
import {
  expenses,
  leases,
  malteseLocalities,
  ownershipSplits,
  properties,
  rentPayments,
  users,
} from "@/db/schema";
import { requireRole } from "@/auth/server";
import { buildTa24Csv, type Ta24PropertyRow } from "@/lib/tax/ta24";
import { resolveRebateBand } from "./leases";

// Builds the TA24 dataset for the given owner + tax year and returns CSV.
// Approved expenses only count for "expenses logged" (rejected are excluded).
export async function exportTa24Csv(taxYear: number): Promise<{
  filename: string;
  csv: string;
}> {
  const owner = await requireRole(["owner"]);
  const yearStart = `${taxYear}-01-01`;
  const yearEnd = `${taxYear + 1}-01-01`;

  // 1. All non-archived properties owned by this user.
  const props = await db
    .select({
      id: properties.id,
      name: properties.name,
      addressLine: properties.addressLine,
      postCode: properties.postCode,
      type: properties.type,
      bedrooms: properties.bedrooms,
      localityName: malteseLocalities.nameEn,
    })
    .from(properties)
    .leftJoin(malteseLocalities, eq(properties.localityId, malteseLocalities.id))
    .where(and(eq(properties.ownerId, owner.id), isNull(properties.archivedAt)));

  if (props.length === 0) {
    return { filename: filenameFor(taxYear), csv: buildTa24Csv([]) };
  }

  const propIds = props.map((p) => p.id);

  // 2. Active lease per property in the year (take first one starting <= yearEnd
  //    and ending after yearStart).
  const allLeases = await db
    .select()
    .from(leases)
    .where(inArray(leases.propertyId, propIds))
    .orderBy(asc(leases.startDate));

  const leaseByProp = new Map<string, (typeof allLeases)[number]>();
  for (const l of allLeases) {
    const inYear =
      l.startDate <= yearEnd &&
      (l.endDate === null || l.endDate >= yearStart);
    if (inYear && !leaseByProp.has(l.propertyId)) leaseByProp.set(l.propertyId, l);
  }

  // 3. Gross rent received in the year per property (sum of confirmed payments,
  //    spec §5: gross rent received in calendar year).
  const rents = await db
    .select({
      leaseId: rentPayments.leaseId,
      amountCents: rentPayments.amountCents,
      paidOn: rentPayments.paidOn,
      status: rentPayments.status,
    })
    .from(rentPayments)
    .where(and(gte(rentPayments.paidOn, yearStart), lt(rentPayments.paidOn, yearEnd)))
    .orderBy(asc(rentPayments.paidOn));

  const grossByProp = new Map<string, number>();
  for (const r of rents) {
    if (r.status !== "confirmed") continue;
    const lease = allLeases.find((l) => l.id === r.leaseId);
    if (!lease) continue;
    grossByProp.set(lease.propertyId, (grossByProp.get(lease.propertyId) ?? 0) + r.amountCents);
  }

  // 4. Approved expenses in the year per property.
  const exps = await db
    .select({
      propertyId: expenses.propertyId,
      amountCents: expenses.amountCents,
      incurredOn: expenses.incurredOn,
      status: expenses.status,
    })
    .from(expenses)
    .where(
      and(
        inArray(expenses.propertyId, propIds),
        gte(expenses.incurredOn, yearStart),
        lt(expenses.incurredOn, yearEnd),
      ),
    );
  const expensesByProp = new Map<string, number>();
  for (const e of exps) {
    if (e.status !== "approved") continue;
    expensesByProp.set(e.propertyId, (expensesByProp.get(e.propertyId) ?? 0) + e.amountCents);
  }

  // 5. Splits as of yearEnd → lookup owner names.
  const splits = await db
    .select({
      propertyId: ownershipSplits.propertyId,
      userId: ownershipSplits.userId,
      bps: ownershipSplits.percentageBps,
      effectiveFrom: ownershipSplits.effectiveFrom,
    })
    .from(ownershipSplits)
    .where(lt(ownershipSplits.effectiveFrom, yearEnd));

  const splitsByProp = new Map<string, Array<{ userId: string; bps: number }>>();
  for (const s of splits) {
    if (!s.propertyId) continue; // global splits handled separately if needed
    const list = splitsByProp.get(s.propertyId) ?? [];
    // Keep only the row for this user with the most recent effective_from.
    const existing = list.findIndex((x) => x.userId === s.userId);
    if (existing >= 0) list.splice(existing, 1);
    list.push({ userId: s.userId, bps: s.bps });
    splitsByProp.set(s.propertyId, list);
  }
  // Resolve names.
  const allUserIds = Array.from(new Set(splits.map((s) => s.userId)));
  const userRows = allUserIds.length
    ? await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, allUserIds))
    : [];
  const nameById = new Map(userRows.map((u) => [u.id, u.name ?? u.email]));

  // 6. Build rows.
  const rows: Ta24PropertyRow[] = [];
  for (const p of props) {
    const lease = leaseByProp.get(p.id);
    const gross = grossByProp.get(p.id) ?? 0;
    const expenses = expensesByProp.get(p.id) ?? 0;

    let rebateCents = 0;
    let rebateLabel: string | null = null;
    if (lease?.rebateBandId) {
      // Take the cached rebate ID; otherwise derive from bedrooms+duration.
      // For Phase 1 we resolve fresh.
    }
    if (lease) {
      const durationYears = lease.endDate
        ? yearsBetween(lease.startDate, lease.endDate)
        : Math.max(1, taxYear - new Date(lease.startDate).getUTCFullYear() + 1);
      const band = await resolveRebateBand({
        bedrooms: p.bedrooms,
        durationYears,
      });
      if (band) {
        rebateCents = band.annualRebateCents;
        rebateLabel = `${p.bedrooms}-bed, ${durationYears}y`;
      }
    }

    rows.push({
      propertyName: p.name,
      address: p.addressLine,
      locality: p.localityName ?? "",
      postCode: p.postCode,
      type: p.type,
      bedrooms: p.bedrooms,
      leaseLlNumber: lease?.llNumber ?? null,
      leaseStart: lease?.startDate ?? null,
      leaseEnd: lease?.endDate ?? null,
      haRegistered: lease?.haRegistered ?? false,
      grossRentCents: gross,
      rebateBandLabel: rebateLabel,
      rebateCents,
      expensesLoggedCents: expenses,
      splits: (splitsByProp.get(p.id) ?? []).map((s) => ({
        ownerName: nameById.get(s.userId) ?? "Unknown",
        bps: s.bps,
      })),
    });
  }

  return { filename: filenameFor(taxYear), csv: buildTa24Csv(rows) };
}

function filenameFor(year: number): string {
  return `TA24-${year}.csv`;
}

function yearsBetween(startIso: string, endIso: string): number {
  const a = new Date(startIso).getTime();
  const b = new Date(endIso).getTime();
  const years = (b - a) / (365.25 * 24 * 3600 * 1000);
  return Math.max(0, Math.floor(years));
}
