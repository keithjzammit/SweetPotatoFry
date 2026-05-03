import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { statements } from "@/db/schema";
import { requireUser } from "@/auth/server";
import { Currency } from "@/components/currency";

export default async function StatementsPage() {
  const user = await requireUser();
  const items = await db
    .select()
    .from(statements)
    .where(eq(statements.coOwnerId, user.id))
    .orderBy(desc(statements.year), desc(statements.month));

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Statements</h1>
      {items.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          No statements yet. Issued on the 1st of each month.
        </div>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {items.map((s) => (
            <li key={s.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3">
              <div className="text-sm font-medium">
                {monthLabel(s.year, s.month)}
              </div>
              <Currency cents={s.totalShareCents} className="text-sm" />
              <a
                href={s.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-primary hover:underline"
              >
                View
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-MT", {
    month: "long",
    year: "numeric",
  });
}
