"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { logRent } from "@/server/rent";

const inputClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function NewRentForm({ leaseId, propertyId }: { leaseId: string; propertyId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          try {
            await logRent({
              leaseId,
              amountEuros: Number(fd.get("amountEuros")),
              periodStart: String(fd.get("periodStart") ?? ""),
              periodEnd: String(fd.get("periodEnd") ?? ""),
              paidOn: String(fd.get("paidOn") ?? ""),
            });
            router.push(`/properties/${propertyId}/rent`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed");
          }
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (€)">
          <input
            name="amountEuros"
            type="number"
            step="0.01"
            min={0}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Paid on">
          <input name="paidOn" type="date" required className={inputClass} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Period start">
          <input name="periodStart" type="date" required className={inputClass} />
        </Field>
        <Field label="Period end">
          <input name="periodEnd" type="date" required className={inputClass} />
        </Field>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending} size="lg" className="w-full md:w-auto">
        {pending ? "Saving…" : "Log rent"}
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
