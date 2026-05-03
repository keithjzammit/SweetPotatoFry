"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTaxElection } from "@/server/tax-election";
import { Button } from "@/components/ui/button";

export function TaxElectionForm({
  year,
  currentElection,
}: {
  year: number;
  currentElection: "FWT_15" | "standard_rates";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="rounded-lg border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          await setTaxElection({
            taxYear: year,
            election: fd.get("election") as "FWT_15" | "standard_rates",
          });
          router.refresh();
        });
      }}
    >
      <h2 className="text-sm font-semibold">Election for {year}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Cannot mix FWT and standard rates within the same year.
      </p>
      <div className="mt-3 space-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="election"
            value="FWT_15"
            defaultChecked={currentElection === "FWT_15"}
          />
          Final Withholding Tax (15%)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="election"
            value="standard_rates"
            defaultChecked={currentElection === "standard_rates"}
          />
          Standard rates (with deductions + 20% maintenance allowance)
        </label>
      </div>
      <Button type="submit" size="sm" className="mt-3" disabled={pending}>
        {pending ? "Saving…" : "Save election"}
      </Button>
    </form>
  );
}
