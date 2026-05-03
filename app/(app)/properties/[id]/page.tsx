import { notFound } from "next/navigation";
import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { leases, malteseLocalities, properties } from "@/db/schema";
import { requirePropertyAccess } from "@/auth/server";
import { Currency } from "@/components/currency";
import { FormattedDate } from "@/components/date";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePropertyAccess(id);

  const rows = await db
    .select({
      id: properties.id,
      name: properties.name,
      addressLine: properties.addressLine,
      postCode: properties.postCode,
      type: properties.type,
      bedrooms: properties.bedrooms,
      bathrooms: properties.bathrooms,
      localityName: malteseLocalities.nameEn,
      defaultTaxElection: properties.defaultTaxElection,
    })
    .from(properties)
    .leftJoin(malteseLocalities, eq(properties.localityId, malteseLocalities.id))
    .where(eq(properties.id, id))
    .limit(1);

  const property = rows[0];
  if (!property) notFound();

  const activeLease = (
    await db
      .select()
      .from(leases)
      .where(and(eq(leases.propertyId, id), isNull(leases.endDate)))
      .orderBy(desc(leases.startDate))
      .limit(1)
  )[0];

  return (
    <article className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{property.name}</h1>
        <p className="text-sm text-muted-foreground">
          {property.addressLine}, {property.localityName} {property.postCode}
        </p>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {property.type} · {property.bedrooms} bed · {property.bathrooms} bath ·{" "}
          {property.defaultTaxElection === "FWT_15" ? "FWT 15%" : "Standard rates"}
        </p>
      </header>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Active lease</h2>
        {activeLease ? (
          <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Monthly fee</dt>
            <dd>
              <Currency cents={activeLease.monthlyFeeCents} />
            </dd>
            <dt className="text-muted-foreground">Start date</dt>
            <dd>
              <FormattedDate value={activeLease.startDate} />
            </dd>
            <dt className="text-muted-foreground">LL number</dt>
            <dd>{activeLease.llNumber ?? "—"}</dd>
            <dt className="text-muted-foreground">HA registered</dt>
            <dd>{activeLease.haRegistered ? "Yes" : "No"}</dd>
          </dl>
        ) : (
          <div className="mt-2 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">No active lease.</p>
            <Link
              href={`/properties/${id}/leases/new`}
              className="text-sm font-medium text-primary hover:underline"
            >
              Create lease
            </Link>
          </div>
        )}
      </section>

      <nav className="flex flex-wrap gap-2 text-sm">
        <TabLink href={`/properties/${id}/expenses`}>Expenses</TabLink>
        <TabLink href={`/properties/${id}/rent`}>Rent</TabLink>
        <TabLink href={`/properties/${id}/works`}>Works</TabLink>
      </nav>
    </article>
  );
}

function TabLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md border bg-background px-3 py-1.5 text-muted-foreground hover:bg-accent"
    >
      {children}
    </Link>
  );
}
