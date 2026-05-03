import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { requireRole } from "@/auth/server";
import { NewLeaseForm } from "./form";

export default async function NewLeasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["owner"]);
  const { id: propertyId } = await params;

  const managers = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.role, "manager"));

  return (
    <section className="max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">New lease</h1>
      <p className="text-sm text-muted-foreground">
        Long-let from owner to property manager. The manager sub-lets to end-tenants.
      </p>
      <NewLeaseForm propertyId={propertyId} managers={managers} />
    </section>
  );
}
