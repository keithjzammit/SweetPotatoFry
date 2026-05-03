import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { expenses } from "@/db/schema";
import { requirePropertyAccess } from "@/auth/server";
import { Currency } from "@/components/currency";
import { FormattedDate } from "@/components/date";
import { Button } from "@/components/ui/button";

export default async function PropertyExpensesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePropertyAccess(id);

  const items = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.propertyId, id), isNull(expenses.archivedAt)))
    .orderBy(desc(expenses.incurredOn))
    .limit(200);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
        <Link href={`/properties/${id}/expenses/new`}>
          <Button size="sm">Log expense</Button>
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          No expenses logged yet.
        </div>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {items.map((it) => (
            <li key={it.id}>
              <Link
                href={`/expenses/${it.id}`}
                className="grid grid-cols-[1fr_auto] gap-2 px-4 py-3 hover:bg-accent"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{it.description}</div>
                  <div className="text-xs text-muted-foreground">
                    {it.category.replace(/_/g, " ")} ·{" "}
                    <FormattedDate value={it.incurredOn} />
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Currency cents={it.amountCents} />
                  <StatusBadge status={it.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: "pending" | "approved" | "rejected" }) {
  const styles =
    status === "approved"
      ? "bg-green-50 text-green-800 ring-green-700/20"
      : status === "rejected"
        ? "bg-red-50 text-red-800 ring-red-700/20"
        : "bg-amber-50 text-amber-800 ring-amber-700/20";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ring-1 ${styles}`}>
      {status}
    </span>
  );
}
