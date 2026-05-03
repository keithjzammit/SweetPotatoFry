"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createLease } from "@/server/leases";

const inputClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function NewLeaseForm({
  propertyId,
  managers,
}: {
  propertyId: string;
  managers: { id: string; name: string | null; email: string }[];
}) {
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
            await createLease({
              propertyId,
              managerId: String(fd.get("managerId") ?? ""),
              monthlyFeeEuros: Number(fd.get("monthlyFeeEuros")),
              startDate: String(fd.get("startDate") ?? ""),
              endDate: (fd.get("endDate") as string) || undefined,
              llNumber: (fd.get("llNumber") as string) || undefined,
              haRegistered: fd.get("haRegistered") === "on",
              article31EFlag: fd.get("article31EFlag") === "on",
            });
            router.push(`/properties/${propertyId}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create lease");
          }
        });
      }}
    >
      <Field label="Manager">
        <select name="managerId" required className={inputClass}>
          <option value="">—</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name ?? m.email}
            </option>
          ))}
        </select>
        {managers.length === 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            No managers yet. Invite one from the People page first.
          </p>
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Monthly fee (€)">
          <input
            name="monthlyFeeEuros"
            type="number"
            step="0.01"
            min={0}
            required
            className={inputClass}
          />
        </Field>
        <Field label="LL number (Housing Authority)">
          <input name="llNumber" maxLength={40} className={inputClass} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date">
          <input name="startDate" type="date" required className={inputClass} />
        </Field>
        <Field label="End date (optional)">
          <input name="endDate" type="date" className={inputClass} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="haRegistered" />
        Registered with the Housing Authority
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="article31EFlag" />
        Article 31E (5% rate) eligibility
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending} size="lg" className="w-full md:w-auto">
        {pending ? "Saving…" : "Create lease"}
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
