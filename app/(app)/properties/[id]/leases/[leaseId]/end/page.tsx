import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { leases } from "@/db/schema";
import { requireRole } from "@/auth/server";
import { EndLeaseForm } from "./form";

export default async function EndLeasePage({
  params,
}: {
  params: Promise<{ id: string; leaseId: string }>;
}) {
  await requireRole(["owner"]);
  const { id: propertyId, leaseId } = await params;

  const lease = (await db.select().from(leases).where(eq(leases.id, leaseId)).limit(1))[0];
  if (!lease || lease.propertyId !== propertyId) notFound();
  if (lease.endDate) {
    return (
      <section className="max-w-xl">
        <h1 className="text-2xl font-semibold tracking-tight">Lease already ended</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          End date: {lease.endDate}
        </p>
      </section>
    );
  }

  return (
    <section className="max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">End lease</h1>
      <p className="text-sm text-muted-foreground">
        The current manager will lose access to future data on this property,
        but keeps read-only access to messages and expenses they themselves
        logged.
      </p>
      <EndLeaseForm propertyId={propertyId} leaseId={leaseId} />
    </section>
  );
}
