"use server";
import "server-only";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { ownershipSplits, properties } from "@/db/schema";
import { requireRole } from "@/auth/server";
import { withAudit } from "@/lib/audit";

const propertyTypeEnum = z.enum([
  "apartment",
  "maisonette",
  "penthouse",
  "townhouse",
  "villa",
  "garage",
  "airspace",
]);

const taxElectionEnum = z.enum(["FWT_15", "standard_rates"]);

const CreateInput = z.object({
  name: z.string().min(1).max(120),
  addressLine: z.string().min(1).max(240),
  localityId: z.coerce.number().int().positive(),
  postCode: z.string().min(3).max(10),
  type: propertyTypeEnum,
  bedrooms: z.coerce.number().int().min(0).max(20),
  bathrooms: z.coerce.number().int().min(0).max(20),
  defaultTaxElection: taxElectionEnum.default("FWT_15"),
});

export async function createProperty(input: z.infer<typeof CreateInput>) {
  const owner = await requireRole(["owner"]);
  const data = CreateInput.parse(input);

  const [row] = await withAudit(
    { action: "property.create", entityType: "property", actorId: owner.id, payload: data },
    async () =>
      db
        .insert(properties)
        .values({
          ...data,
          ownerId: owner.id,
        })
        .returning(),
  );

  // Bootstrap a 100% ownership split so the owner appears in the splits table.
  // Co-owners get added later via setOwnershipSplits().
  if (row) {
    const today = new Date().toISOString().slice(0, 10);
    await db.insert(ownershipSplits).values({
      propertyId: row.id,
      userId: owner.id,
      percentageBps: 10000,
      effectiveFrom: today,
    });
  }

  revalidatePath("/properties");
  return { id: row?.id };
}

const SplitsInput = z.object({
  propertyId: z.string().uuid(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  splits: z
    .array(
      z.object({
        userId: z.string().uuid(),
        percentageBps: z.number().int().positive().max(10000),
      }),
    )
    .min(1),
});

// Spec §4: per (property, effective_from) sum of percentages must = 100.
// Postgres can't enforce this with a CHECK alone, so we validate here and
// wrap the insert in a transaction so we never persist an invalid set.
export async function setOwnershipSplits(input: z.infer<typeof SplitsInput>) {
  const owner = await requireRole(["owner"]);
  const data = SplitsInput.parse(input);

  const total = data.splits.reduce((s, x) => s + x.percentageBps, 0);
  if (total !== 10000) {
    throw new Error(`Splits must sum to 100% (got ${total / 100}%)`);
  }

  await withAudit(
    {
      action: "property.set_splits",
      entityType: "property",
      actorId: owner.id,
      payload: { propertyId: data.propertyId, splits: data.splits },
    },
    async () => {
      return db.transaction(async (tx) => {
        // Replace splits for this property + date.
        await tx
          .delete(ownershipSplits)
          .where(
            and(
              eq(ownershipSplits.propertyId, data.propertyId),
              eq(ownershipSplits.effectiveFrom, data.effectiveFrom),
            ),
          );
        return tx.insert(ownershipSplits).values(
          data.splits.map((s) => ({
            propertyId: data.propertyId,
            userId: s.userId,
            percentageBps: s.percentageBps,
            effectiveFrom: data.effectiveFrom,
          })),
        );
      });
    },
  );

  revalidatePath(`/properties/${data.propertyId}`);
}

export async function archiveProperty(propertyId: string) {
  const owner = await requireRole(["owner"]);
  await withAudit(
    { action: "property.archive", entityType: "property", actorId: owner.id },
    async () =>
      db
        .update(properties)
        .set({ archivedAt: new Date() })
        .where(and(eq(properties.id, propertyId), isNull(properties.archivedAt)))
        .returning(),
  );
  revalidatePath("/properties");
}
