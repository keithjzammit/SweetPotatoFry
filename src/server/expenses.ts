"use server";
import "server-only";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { approvalRules, expenses, properties, users, type ApprovalLogEntry } from "@/db/schema";
import { requirePropertyAccess, requireUser } from "@/auth/server";
import { withAudit } from "@/lib/audit";
import { toCents, formatEuro } from "@/lib/money";
import { sendApprovalRequestEmail } from "@/lib/email";
import { sendPush } from "@/lib/push";

const DEFAULT_THRESHOLD_CENTS = 50_000; // €500 per spec §6

const LogExpenseInput = z.object({
  propertyId: z.string().uuid(),
  amountEuros: z.coerce.number().positive(),
  category: z.enum(["white_goods", "repair_over_200", "utilities", "other"]),
  description: z.string().min(1).max(2000),
  incurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  receiptUrl: z.string().url(), // spec §9: required
});

// Spec §6 flow:
// 1. Manager logs expense, status = pending
// 2. If amount < threshold OR no required approvers, owner alone approves
// 3. If amount >= threshold, push + email to all required approvers
export async function logExpense(input: z.infer<typeof LogExpenseInput>) {
  const user = await requireUser();
  const data = LogExpenseInput.parse(input);
  await requirePropertyAccess(data.propertyId);

  const amountCents = toCents(data.amountEuros);

  // Resolve effective approval rule (property-specific overrides global).
  const rules = await db
    .select()
    .from(approvalRules)
    .where(
      or(eq(approvalRules.propertyId, data.propertyId), isNull(approvalRules.propertyId)),
    );
  const rule =
    rules.find((r) => r.propertyId === data.propertyId) ?? rules.find((r) => !r.propertyId);
  const threshold = rule?.thresholdCents ?? DEFAULT_THRESHOLD_CENTS;
  const requiredApprovers = rule?.requiredApprovers ?? [];

  // Owner self-logs always auto-approve. Otherwise above-threshold expenses
  // with required approvers stay pending.
  const needsExternalApproval =
    user.role !== "owner" && amountCents >= threshold && requiredApprovers.length > 0;

  const [row] = await withAudit(
    {
      action: "expense.log",
      entityType: "expense",
      actorId: user.id,
      payload: { ...data, amountCents, needsExternalApproval },
    },
    async () =>
      db
        .insert(expenses)
        .values({
          propertyId: data.propertyId,
          amountCents,
          category: data.category,
          description: data.description,
          incurredOn: data.incurredOn,
          loggedBy: user.id,
          receiptUrl: data.receiptUrl,
          status: needsExternalApproval ? "pending" : "approved",
          approvalLog: needsExternalApproval
            ? []
            : ([
                {
                  userId: user.id,
                  action: "approved",
                  comment: "Auto-approved (under threshold or owner)",
                  at: new Date().toISOString(),
                },
              ] satisfies ApprovalLogEntry[]),
        })
        .returning(),
  );

  // Notify approvers if pending.
  if (needsExternalApproval && row) {
    const approvers = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(or(...requiredApprovers.map((id) => eq(users.id, id))));
    const property = (
      await db
        .select({ name: properties.name })
        .from(properties)
        .where(eq(properties.id, data.propertyId))
        .limit(1)
    )[0];

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const propertyName = property?.name ?? "your property";
    const amountDisplay = formatEuro(amountCents);
    await Promise.all([
      ...approvers.map((a) =>
        sendApprovalRequestEmail({
          to: a.email,
          propertyName,
          amountDisplay,
          description: data.description,
          approveUrl: `${baseUrl}/expenses/${row.id}`,
        }),
      ),
      ...approvers.map((a) =>
        sendPush(a.id, {
          title: `Approval needed: ${amountDisplay}`,
          body: `${propertyName} — ${data.description.slice(0, 80)}`,
          url: `/expenses/${row.id}`,
          tag: `approval-${row.id}`,
        }),
      ),
    ]);
  }

  revalidatePath("/dashboard");
  revalidatePath(`/properties/${data.propertyId}/expenses`);
  return { id: row?.id, status: row?.status };
}

const DecisionInput = z.object({
  expenseId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  comment: z.string().max(2000).optional(),
});

// Spec §6: "All approvals = status approved. Any rejection = status rejected,
// expense not counted in P&L."
export async function decideExpense(input: z.infer<typeof DecisionInput>) {
  const user = await requireUser();
  const data = DecisionInput.parse(input);

  const expense = (
    await db.select().from(expenses).where(eq(expenses.id, data.expenseId)).limit(1)
  )[0];
  if (!expense) throw new Error("Expense not found or access denied");
  if (expense.status !== "pending") throw new Error("Expense already decided");

  // Append to approval log.
  const newEntry: ApprovalLogEntry = {
    userId: user.id,
    action: data.decision === "approve" ? "approved" : "rejected",
    comment: data.comment,
    at: new Date().toISOString(),
  };
  const newLog = [...expense.approvalLog, newEntry];

  // Determine new status: any rejection → rejected; otherwise check whether
  // every required approver has now approved.
  let nextStatus: "pending" | "approved" | "rejected" = expense.status;
  if (data.decision === "reject") {
    nextStatus = "rejected";
  } else {
    // Look up the rule again to know who all the required approvers are.
    const rules = await db
      .select()
      .from(approvalRules)
      .where(
        or(eq(approvalRules.propertyId, expense.propertyId), isNull(approvalRules.propertyId)),
      );
    const rule =
      rules.find((r) => r.propertyId === expense.propertyId) ?? rules.find((r) => !r.propertyId);
    const required = new Set(rule?.requiredApprovers ?? []);
    const approvedBy = new Set(
      newLog.filter((e) => e.action === "approved").map((e) => e.userId),
    );
    const allApproved = [...required].every((id) => approvedBy.has(id));
    if (allApproved) nextStatus = "approved";
  }

  await withAudit(
    {
      action: data.decision === "approve" ? "expense.approve" : "expense.reject",
      entityType: "expense",
      actorId: user.id,
      payload: { expenseId: data.expenseId, comment: data.comment, nextStatus },
    },
    async () =>
      db
        .update(expenses)
        .set({ status: nextStatus, approvalLog: newLog })
        .where(and(eq(expenses.id, data.expenseId), eq(expenses.status, "pending")))
        .returning(),
  );

  revalidatePath("/dashboard");
  revalidatePath(`/expenses/${data.expenseId}`);
}

// Daily archival — called by /api/cron/archive (spec §9: 12-month auto-archive).
export async function archiveOldExpenses() {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 12);
  await db
    .update(expenses)
    .set({ archivedAt: new Date() })
    .where(and(isNull(expenses.archivedAt), lt(expenses.createdAt, cutoff)));
}
