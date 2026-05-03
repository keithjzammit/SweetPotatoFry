"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { decideExpense } from "@/server/expenses";

export function ApprovalActions({ expenseId }: { expenseId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  const decide = (decision: "approve" | "reject") =>
    startTransition(async () => {
      try {
        await decideExpense({ expenseId, decision, comment: comment || undefined });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });

  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="text-sm font-semibold">Your decision</h2>
      <textarea
        rows={2}
        placeholder="Optional comment"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="mt-3 flex gap-2">
        <Button onClick={() => decide("approve")} disabled={pending}>
          Approve
        </Button>
        <Button variant="destructive" onClick={() => decide("reject")} disabled={pending}>
          Reject
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </section>
  );
}
