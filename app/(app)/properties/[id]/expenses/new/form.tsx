"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { logExpense } from "@/server/expenses";

const inputClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function NewExpenseForm({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!receiptUrl) {
          setError("Receipt is required");
          return;
        }
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          try {
            await logExpense({
              propertyId,
              amountEuros: Number(fd.get("amountEuros")),
              category: fd.get("category") as
                | "white_goods"
                | "repair_over_200"
                | "utilities"
                | "other",
              description: String(fd.get("description") ?? ""),
              incurredOn: String(fd.get("incurredOn") ?? ""),
              receiptUrl,
            });
            router.push(`/properties/${propertyId}/expenses`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed");
          }
        });
      }}
    >
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
      <Field label="Category">
        <select name="category" required className={inputClass}>
          <option value="utilities">Utilities</option>
          <option value="repair_over_200">Repair (over €200)</option>
          <option value="white_goods">White goods</option>
          <option value="other">Other</option>
        </select>
      </Field>
      <Field label="Description">
        <textarea
          name="description"
          required
          maxLength={2000}
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </Field>
      <Field label="Date incurred">
        <input name="incurredOn" type="date" required className={inputClass} />
      </Field>
      <Field label="Receipt (required)">
        <input
          type="file"
          accept="image/*,application/pdf"
          required
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setUploading(true);
            setError(null);
            try {
              const fd = new FormData();
              fd.set("kind", "expense-receipt");
              fd.set("file", file);
              fd.set("propertyId", propertyId);
              const res = await fetch("/api/upload", { method: "POST", body: fd });
              if (!res.ok) throw new Error("Upload failed");
              const json = (await res.json()) as { url: string };
              setReceiptUrl(json.url);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Upload failed");
            } finally {
              setUploading(false);
            }
          }}
        />
        {uploading && <p className="mt-1 text-xs text-muted-foreground">Uploading…</p>}
        {receiptUrl && (
          <p className="mt-1 text-xs text-muted-foreground">Receipt attached.</p>
        )}
      </Field>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending || uploading} size="lg" className="w-full md:w-auto">
        {pending ? "Saving…" : "Log expense"}
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
