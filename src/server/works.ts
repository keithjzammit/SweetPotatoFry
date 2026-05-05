"use server";
import "server-only";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { works } from "@/db/schema";
import { requirePropertyAccess, requireUser } from "@/auth/server";
import { withAudit } from "@/lib/audit";
import { pushWorkToGoogleCalendar, deleteWorkFromGoogleCalendar } from "@/lib/google-calendar";

const CreateInput = z.object({
  propertyId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  scheduledStart: z.string().datetime().optional(),
  scheduledEnd: z.string().datetime().optional(),
  assignedTo: z.string().uuid().optional(),
});

export async function createWork(input: z.infer<typeof CreateInput>) {
  const user = await requireUser();
  const data = CreateInput.parse(input);
  await requirePropertyAccess(data.propertyId);

  const [row] = await withAudit(
    { action: "work.create", entityType: "work", actorId: user.id, payload: data },
    async () =>
      db
        .insert(works)
        .values({
          propertyId: data.propertyId,
          title: data.title,
          description: data.description ?? null,
          scheduledStart: data.scheduledStart ? new Date(data.scheduledStart) : null,
          scheduledEnd: data.scheduledEnd ? new Date(data.scheduledEnd) : null,
          assignedTo: data.assignedTo ?? user.id,
        })
        .returning(),
  );

  if (row && row.scheduledStart) {
    // Best-effort: if creator has a Google refresh token, push the event.
    const googleEventId = await pushWorkToGoogleCalendar({
      userId: user.id,
      work: {
        id: row.id,
        title: row.title,
        description: row.description ?? "",
        start: row.scheduledStart,
        end: row.scheduledEnd ?? row.scheduledStart,
      },
    }).catch((e) => {
      console.error("[google-calendar] push failed", e);
      return null;
    });
    if (googleEventId) {
      await db.update(works).set({ googleEventId }).where(eq(works.id, row.id));
    }
  }

  revalidatePath(`/properties/${data.propertyId}/works`);
  return { id: row?.id };
}

const StatusInput = z.object({
  workId: z.string().uuid(),
  status: z.enum(["scheduled", "in_progress", "done", "cancelled"]),
  completionNotes: z.string().max(5000).optional(),
});

export async function updateWorkStatus(input: z.infer<typeof StatusInput>) {
  const user = await requireUser();
  const data = StatusInput.parse(input);

  const [row] = await withAudit(
    { action: "work.update_status", entityType: "work", actorId: user.id, payload: data },
    async () =>
      db
        .update(works)
        .set({
          status: data.status,
          completionNotes: data.completionNotes ?? null,
        })
        .where(eq(works.id, data.workId))
        .returning(),
  );

  // If cancelled, remove from Google Calendar (best-effort).
  if (row && data.status === "cancelled" && row.googleEventId) {
    await deleteWorkFromGoogleCalendar({
      userId: user.id,
      eventId: row.googleEventId,
    }).catch((e) => console.error("[google-calendar] delete failed", e));
  }

  if (row) {
    revalidatePath(`/properties/${row.propertyId}/works`);
  }
}
