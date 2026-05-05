import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { works } from "@/db/schema";
import { requirePropertyAccess } from "@/auth/server";
import { FormattedDate } from "@/components/date";
import { Button } from "@/components/ui/button";

export default async function PropertyWorksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePropertyAccess(id);

  const items = await db
    .select()
    .from(works)
    .where(eq(works.propertyId, id))
    .orderBy(desc(works.scheduledStart))
    .limit(200);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Works</h1>
        <Link href={`/properties/${id}/works/new`}>
          <Button size="sm">Schedule work</Button>
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          No works scheduled.
        </div>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {items.map((w) => (
            <li key={w.id} className="grid grid-cols-[1fr_auto] gap-2 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{w.title}</div>
                <div className="text-xs text-muted-foreground">
                  {w.scheduledStart ? <FormattedDate value={w.scheduledStart} /> : "Unscheduled"}{" "}
                  · {w.status.replace(/_/g, " ")}
                </div>
              </div>
              {w.scheduledStart && (
                <a
                  href={`/api/works/${w.id}/ics`}
                  className="self-center text-xs font-medium text-primary hover:underline"
                >
                  .ics
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
