"use server";
import "server-only";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { leases, rentPayments } from "@/db/schema";
import { requireUser } from "@/auth/server";
import { withAudit } from "@/lib/audit";
import { toCents } from "@/lib/money";

const LogRentInput = z.object({
  leaseId: z.string().uuid(),
  amountEuros: z.coerce.number().positive(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  receiptUrl: z.string().url().optional(),
});

// Manager logs rent → status 'pending'. Owner confirms.
export async function logRent(input: z.infer<typeof LogRentInput>) {
  const user = await requireUser();
  const data = LogRentInput.parse(input);

  // Verify lease exists; RLS will reject if user lacks access.
  const lease = (await db.select().from(leases).where(eq(leases.id, data.leaseId)).limit(1))[0];
  if (!lease) throw new Error("Lease not found or access denied");

  const [row] = await withAudit(
    { action: "rent.log", entityType: "rent_payment", actorId: user.id, payload: data },
    async () =>
      db
        .insert(rentPayments)
        .values({
          leaseId: data.leaseId,
          amountCents: toCents(data.amountEuros),
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          paidOn: data.paidOn,
          loggedBy: user.id,
          receiptUrl: data.receiptUrl ?? null,
          // If owner logs it, mark confirmed immediately.
          status: user.role === "owner" ? "confirmed" : "pending",
          confirmedAt: user.role === "owner" ? new Date() : null,
        })
        .returning(),
  );

  revalidatePath("/dashboard");
  return { id: row?.id };
}

export async function confirmRent(rentId: string) {
  const user = await requireUser();
  if (user.role !== "owner") throw new Error("Only owners can confirm rent");
  await withAudit(
    { action: "rent.confirm", entityType: "rent_payment", actorId: user.id },
    async () =>
      db
        .update(rentPayments)
        .set({ status: "confirmed", confirmedAt: new Date() })
        .where(eq(rentPayments.id, rentId))
        .returning(),
  );
  revalidatePath("/dashboard");
}
