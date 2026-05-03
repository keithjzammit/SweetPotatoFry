"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createProperty } from "@/server/properties";

const PROPERTY_TYPES = [
  "apartment",
  "maisonette",
  "penthouse",
  "townhouse",
  "villa",
  "garage",
  "airspace",
] as const;

export function NewPropertyForm({
  localities,
}: {
  localities: { id: number; nameEn: string }[];
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
            await createProperty({
              name: String(fd.get("name") ?? ""),
              addressLine: String(fd.get("addressLine") ?? ""),
              localityId: Number(fd.get("localityId")),
              postCode: String(fd.get("postCode") ?? ""),
              type: fd.get("type") as (typeof PROPERTY_TYPES)[number],
              bedrooms: Number(fd.get("bedrooms")),
              bathrooms: Number(fd.get("bathrooms")),
              defaultTaxElection: fd.get("defaultTaxElection") as "FWT_15" | "standard_rates",
            });
            router.push("/properties");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create");
          }
        });
      }}
    >
      <Field label="Name (e.g. Block 5, Apt 3)">
        <input name="name" required maxLength={120} className={inputClass} />
      </Field>
      <Field label="Address line">
        <input name="addressLine" required maxLength={240} className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Locality">
          <select name="localityId" required className={inputClass}>
            <option value="">—</option>
            {localities.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nameEn}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Post code">
          <input name="postCode" required maxLength={10} className={inputClass} />
        </Field>
      </div>
      <Field label="Type">
        <select name="type" required className={inputClass}>
          {PROPERTY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Bedrooms">
          <input
            name="bedrooms"
            type="number"
            min={0}
            max={20}
            required
            defaultValue={0}
            className={inputClass}
          />
        </Field>
        <Field label="Bathrooms">
          <input
            name="bathrooms"
            type="number"
            min={0}
            max={20}
            required
            defaultValue={0}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Default tax election">
        <select name="defaultTaxElection" required className={inputClass} defaultValue="FWT_15">
          <option value="FWT_15">Final Withholding Tax (15%)</option>
          <option value="standard_rates">Standard rates</option>
        </select>
      </Field>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending} size="lg" className="w-full md:w-auto">
        {pending ? "Saving…" : "Create property"}
      </Button>
    </form>
  );
}

const inputClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
