"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { endLease } from "@/server/leases";

const inputClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function EndLeaseForm({
  propertyId,
  leaseId,
}: {
  propertyId: string;
  leaseId: string;
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
            await endLease({
              leaseId,
              endDate: String(fd.get("endDate") ?? ""),
              handoverNotes: (fd.get("handoverNotes") as string) || undefined,
            });
            router.push(`/properties/${propertyId}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed");
          }
        });
      }}
    >
      <label className="block space-y-1">
        <span className="text-sm font-medium">End date</span>
        <input
          name="endDate"
          type="date"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
          className={inputClass}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Handover notes (visible to next manager)</span>
        <textarea
          name="handoverNotes"
          rows={6}
          maxLength={5000}
          placeholder="Anything the next manager should know — keys location, ongoing issues, tenant context, etc."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending} size="lg" variant="destructive">
        {pending ? "Ending…" : "End lease"}
      </Button>
    </form>
  );
}
