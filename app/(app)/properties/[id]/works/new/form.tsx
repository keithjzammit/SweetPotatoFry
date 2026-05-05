"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createWork } from "@/server/works";

const inputClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function NewWorkForm({ propertyId }: { propertyId: string }) {
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
            await createWork({
              propertyId,
              title: String(fd.get("title") ?? ""),
              description: (fd.get("description") as string) || undefined,
              scheduledStart: toIsoOrUndef(fd.get("scheduledStart") as string),
              scheduledEnd: toIsoOrUndef(fd.get("scheduledEnd") as string),
            });
            router.push(`/properties/${propertyId}/works`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed");
          }
        });
      }}
    >
      <Field label="Title">
        <input name="title" required maxLength={200} className={inputClass} />
      </Field>
      <Field label="Description">
        <textarea
          name="description"
          maxLength={5000}
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start">
          <input name="scheduledStart" type="datetime-local" className={inputClass} />
        </Field>
        <Field label="End">
          <input name="scheduledEnd" type="datetime-local" className={inputClass} />
        </Field>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending} size="lg" className="w-full md:w-auto">
        {pending ? "Saving…" : "Schedule"}
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

function toIsoOrUndef(v: string): string | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}
