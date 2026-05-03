import "server-only";
import { db } from "@/db/client";
import { auditLog } from "@/db/schema";

type AuditMeta = {
  action: string;
  entityType: string;
  actorId: string | null;
  payload?: Record<string, unknown>;
};

// Wraps a mutation so that on success an audit_log row is written. The
// returning-array shape lets callers use the result like Drizzle's normal
// .returning() value, e.g. `const [row] = await withAudit(...);`.
export async function withAudit<T>(
  meta: AuditMeta,
  fn: () => Promise<T>,
): Promise<T> {
  const result = await fn();
  // Best-effort entity id extraction.
  const entityId = extractEntityId(result);
  await db.insert(auditLog).values({
    userId: meta.actorId,
    action: meta.action,
    entityType: meta.entityType,
    entityId: entityId ?? "00000000-0000-0000-0000-000000000000",
    payload: meta.payload ?? null,
  });
  return result;
}

function extractEntityId(result: unknown): string | null {
  if (Array.isArray(result) && result.length > 0) {
    const first = result[0] as { id?: unknown };
    if (first && typeof first.id === "string") return first.id;
  }
  if (result && typeof result === "object" && "id" in result) {
    const id = (result as { id?: unknown }).id;
    if (typeof id === "string") return id;
  }
  return null;
}
