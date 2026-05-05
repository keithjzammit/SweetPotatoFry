"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createInvite } from "@/server/invites";

const inputClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function InviteForm({
  properties,
}: {
  properties: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"manager" | "co_owner">("manager");
  const [propertyIds, setPropertyIds] = useState<string[]>([]);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const splitPctRaw = fd.get("splitPct");
        const defaultSplitBps =
          role === "co_owner" && splitPctRaw
            ? Math.round(Number(splitPctRaw) * 100)
            : undefined;
        startTransition(async () => {
          try {
            await createInvite({
              email: String(fd.get("email") ?? "").trim(),
              role,
              metadata: {
                propertyIds: role === "manager" ? propertyIds : undefined,
                defaultSplitBps,
              },
            });
            (e.target as HTMLFormElement).reset();
            setPropertyIds([]);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed");
          }
        });
      }}
    >
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Email</span>
          <input name="email" type="email" required className={inputClass} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "manager" | "co_owner")}
            className={inputClass}
          >
            <option value="manager">Manager</option>
            <option value="co_owner">Co-owner</option>
          </select>
        </label>
      </div>

      {role === "manager" && (
        <div className="space-y-1">
          <span className="text-sm font-medium">Properties they will manage</span>
          <div className="grid gap-1">
            {properties.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={propertyIds.includes(p.id)}
                  onChange={(e) => {
                    setPropertyIds((cur) =>
                      e.target.checked
                        ? [...cur, p.id]
                        : cur.filter((x) => x !== p.id),
                    );
                  }}
                />
                {p.name}
              </label>
            ))}
            {properties.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No properties yet. Create one first.
              </p>
            )}
          </div>
        </div>
      )}

      {role === "co_owner" && (
        <label className="block space-y-1">
          <span className="text-sm font-medium">Default split (%)</span>
          <input
            name="splitPct"
            type="number"
            step="0.01"
            min={0.01}
            max={100}
            placeholder="e.g. 50"
            className={inputClass}
          />
          <p className="text-xs text-muted-foreground">
            Applied as a global split when they accept; refine per-property afterwards.
          </p>
        </label>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send invite"}
      </Button>
    </form>
  );
}
