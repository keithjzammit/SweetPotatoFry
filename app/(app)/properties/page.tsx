import Link from "next/link";
import { desc, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { properties, malteseLocalities } from "@/db/schema";
import { requireUser } from "@/auth/server";
import { Button } from "@/components/ui/button";

export default async function PropertiesPage() {
  const user = await requireUser();

  const items = await db
    .select({
      id: properties.id,
      name: properties.name,
      addressLine: properties.addressLine,
      bedrooms: properties.bedrooms,
      bathrooms: properties.bathrooms,
      type: properties.type,
      localityId: properties.localityId,
    })
    .from(properties)
    .where(isNull(properties.archivedAt))
    .orderBy(desc(properties.createdAt))
    .limit(100);

  const localities = await db.select().from(malteseLocalities);
  const localityById = new Map(localities.map((l) => [l.id, l.nameEn]));

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Properties</h1>
        {user.role === "owner" && (
          <Link href="/properties/new">
            <Button size="sm">New property</Button>
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState role={user.role} />
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {items.map((it) => (
            <li key={it.id}>
              <Link
                href={`/properties/${it.id}`}
                className="flex flex-col gap-1 px-4 py-3 hover:bg-accent"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{it.name}</span>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {it.type}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {it.addressLine}, {localityById.get(it.localityId)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {it.bedrooms} bed · {it.bathrooms} bath
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EmptyState({ role }: { role: string }) {
  return (
    <div className="rounded-lg border bg-card p-10 text-center">
      <p className="text-sm text-muted-foreground">
        {role === "owner"
          ? "No properties yet. Create your first one to get started."
          : "No properties have been shared with you yet."}
      </p>
    </div>
  );
}
