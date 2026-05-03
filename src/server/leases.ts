"use server";
import "server-only";
import { revalidatePath } from "next/cache";
import { and, desc, eq, isNull, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { leases, rebateBands } from "@/db/schema";
import { requirePropertyAccess, requireRole } from "@/auth/server";
import { withAudit } from "@/lib/audit";
import { toCents } from "@/lib/money";

const CreateLeaseInput = z.object({
  propertyId: z.string().uuid(),
  managerId: z.string().uuid(),
  monthlyFeeEuros: z.coerce.number().positive(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  llNumber: z.string().max(40).optional(),
  haRegistered: z.boolean().default(false),
  article31EFlag: z.boolean().default(false),
});

export async function createLease(input: z.infer<typeof CreateLeaseInput>) {
  const owner = await requireRole(["owner"]);
  const data = CreateLeaseInput.parse(input);
  await requirePropertyAccess(data.propertyId);

  const [row] = await withAudit(
    { action: "lease.create", entityType: "lease", actorId: owner.id, payload: data },
    async () =>
      db
        .insert(leases)
        .values({
          propertyId: data.propertyId,
          managerId: data.managerId,
          monthlyFeeCents: toCents(data.monthlyFeeEuros),
          startDate: data.startDate,
          endDate: data.endDate ?? null,
          llNumber: data.llNumber ?? null,
          haRegistered: data.haRegistered,
          article31EFlag: data.article31EFlag,
        })
        .returning(),
  );
  revalidatePath(`/properties/${data.propertyId}`);
  return { id: row?.id };
}

const EndLeaseInput = z.object({
  leaseId: z.string().uuid(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  handoverNotes: z.string().max(5000).optional(),
});

// Spec §7: prompts for end date and handover notes; manager loses access to
// future data (RLS already enforces this via end_date >= CURRENT_DATE).
export async function endLease(input: z.infer<typeof EndLeaseInput>) {
  const owner = await requireRole(["owner"]);
  const data = EndLeaseInput.parse(input);

  await withAudit(
    { action: "lease.end", entityType: "lease", actorId: owner.id, payload: data },
    async () =>
      db
        .update(leases)
        .set({ endDate: data.endDate, handoverNotes: data.handoverNotes ?? null })
        .where(eq(leases.id, data.leaseId))
        .returning(),
  );
  revalidatePath("/properties");
}

// Resolve the rebate band for a lease (bedrooms × duration).
// Spec §5: take the row with largest min_duration_years still satisfied,
// constrained by the most recent effective_from <= today.
export async function resolveRebateBand(opts: {
  bedrooms: number;
  durationYears: number;
}): Promise<{ id: number; annualRebateCents: number } | null> {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select({ id: rebateBands.id, annualRebateCents: rebateBands.annualRebateCents })
    .from(rebateBands)
    .where(
      and(
        eq(rebateBands.bedrooms, opts.bedrooms),
        lte(rebateBands.minDurationYears, opts.durationYears),
        lte(rebateBands.effectiveFrom, today),
      ),
    )
    .orderBy(desc(rebateBands.minDurationYears), desc(rebateBands.effectiveFrom))
    .limit(1);

  return rows[0] ?? null;
}

void isNull;
