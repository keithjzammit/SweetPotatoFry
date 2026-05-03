import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { leases } from "@/db/schema";
import { requirePropertyAccess } from "@/auth/server";
import { NewRentForm } from "./form";

export default async function NewRentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePropertyAccess(id);

  const activeLease = (
    await db
      .select()
      .from(leases)
      .where(and(eq(leases.propertyId, id), isNull(leases.endDate)))
      .orderBy(desc(leases.startDate))
      .limit(1)
  )[0];

  if (!activeLease) {
    return (
      <section className="max-w-xl">
        <h1 className="text-2xl font-semibold tracking-tight">Log rent</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          No active lease for this property.
        </p>
      </section>
    );
  }

  return (
    <section className="max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Log rent</h1>
      <NewRentForm leaseId={activeLease.id} propertyId={id} />
    </section>
  );
}
