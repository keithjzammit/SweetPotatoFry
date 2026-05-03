"use server";
import "server-only";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { taxElections } from "@/db/schema";
import { requireRole } from "@/auth/server";
import { withAudit } from "@/lib/audit";

const Input = z.object({
  taxYear: z.number().int().min(2020).max(2100),
  election: z.enum(["FWT_15", "standard_rates"]),
});

export async function setTaxElection(input: z.infer<typeof Input>) {
  const owner = await requireRole(["owner"]);
  const data = Input.parse(input);

  await withAudit(
    {
      action: "tax.set_election",
      entityType: "tax_election",
      actorId: owner.id,
      payload: data,
    },
    async () => {
      const existing = await db
        .select({ id: taxElections.id })
        .from(taxElections)
        .where(
          and(eq(taxElections.ownerId, owner.id), eq(taxElections.taxYear, data.taxYear)),
        )
        .limit(1);
      if (existing[0]) {
        return db
          .update(taxElections)
          .set({ election: data.election })
          .where(eq(taxElections.id, existing[0].id))
          .returning();
      }
      return db
        .insert(taxElections)
        .values({ ownerId: owner.id, taxYear: data.taxYear, election: data.election })
        .returning();
    },
  );

  revalidatePath("/tax");
}
