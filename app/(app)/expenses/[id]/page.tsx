import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { approvalRules, expenses, properties } from "@/db/schema";
import { requireUser } from "@/auth/server";
import { Currency } from "@/components/currency";
import { FormattedDate } from "@/components/date";
import { ApprovalActions } from "./approval-actions";

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const rows = await db
    .select({
      expense: expenses,
      propertyName: properties.name,
    })
    .from(expenses)
    .leftJoin(properties, eq(expenses.propertyId, properties.id))
    .where(eq(expenses.id, id))
    .limit(1);

  if (rows.length === 0) notFound();
  const { expense, propertyName } = rows[0]!;

  // Determine if this user is a required approver of a still-pending expense.
  let canDecide = false;
  if (expense.status === "pending") {
    const rules = await db.select().from(approvalRules);
    const rule =
      rules.find((r) => r.propertyId === expense.propertyId) ??
      rules.find((r) => !r.propertyId);
    canDecide = (rule?.requiredApprovers ?? []).includes(user.id);
  }

  return (
    <article className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          <Currency cents={expense.amountCents} />
        </h1>
        <p className="text-sm text-muted-foreground">
          {propertyName} · {expense.category.replace(/_/g, " ")} ·{" "}
          <FormattedDate value={expense.incurredOn} />
        </p>
      </header>

      <section className="rounded-lg border bg-card p-4">
        <p className="text-sm">{expense.description}</p>
        {expense.receiptUrl && (
          <a
            href={expense.receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
          >
            View receipt
          </a>
        )}
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Approval log</h2>
        {expense.approvalLog.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No decisions yet.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {expense.approvalLog.map((e, i) => (
              <li key={i}>
                <span className="font-medium">{e.action}</span> ·{" "}
                <FormattedDate value={e.at} />
                {e.comment && <span className="text-muted-foreground"> — {e.comment}</span>}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">
          Status: {expense.status}
        </p>
      </section>

      {canDecide && <ApprovalActions expenseId={expense.id} />}
    </article>
  );
}
