import { requirePropertyAccess } from "@/auth/server";
import { NewExpenseForm } from "./form";

export default async function NewExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePropertyAccess(id);
  return (
    <section className="max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Log expense</h1>
      <p className="text-sm text-muted-foreground">
        Receipts are required. Above-threshold expenses go to the configured
        approvers before counting in P&amp;L.
      </p>
      <NewExpenseForm propertyId={id} />
    </section>
  );
}
