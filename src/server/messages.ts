"use server";
import "server-only";
import { revalidatePath } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { messages } from "@/db/schema";
import { requirePropertyAccess, requireUser } from "@/auth/server";
import { translateToBoth } from "@/lib/translate";
import { sendPush } from "@/lib/push";
import { withAudit } from "@/lib/audit";
import { isLocale } from "@/i18n/config";

const SendInput = z.object({
  propertyId: z.string().uuid(),
  threadId: z.string().uuid().optional(), // null → start a new thread
  body: z.string().min(1).max(8000),
  attachments: z.array(z.string().url()).max(10).optional(),
});

export async function sendMessage(input: z.infer<typeof SendInput>) {
  const user = await requireUser();
  const data = SendInput.parse(input);
  await requirePropertyAccess(data.propertyId);

  const { detectedLang, translations } = await translateToBoth(data.body);
  const lang = isLocale(detectedLang.slice(0, 2)) ? detectedLang.slice(0, 2) : "en";

  const threadId = data.threadId ?? crypto.randomUUID();

  const [row] = await withAudit(
    {
      action: "message.send",
      entityType: "message",
      actorId: user.id,
      payload: { propertyId: data.propertyId, threadId, lang },
    },
    async () =>
      db
        .insert(messages)
        .values({
          threadId,
          propertyId: data.propertyId,
          senderId: user.id,
          bodyOriginal: data.body,
          bodyLang: lang,
          bodyTranslatedEn: translations.en,
          bodyTranslatedEs: translations.es,
          attachments: data.attachments ?? [],
        })
        .returning(),
  );

  // Notify the other participants in the thread.
  if (row) {
    await notifyThreadParticipants({
      threadId,
      propertyId: data.propertyId,
      excludeUserId: user.id,
      preview: data.body.slice(0, 80),
    });
  }

  revalidatePath(`/properties/${data.propertyId}/messages`);
  return { id: row?.id, threadId };
}

async function notifyThreadParticipants(opts: {
  threadId: string;
  propertyId: string;
  excludeUserId: string;
  preview: string;
}) {
  const senders = await db
    .selectDistinct({ senderId: messages.senderId })
    .from(messages)
    .where(eq(messages.threadId, opts.threadId));
  await Promise.all(
    senders
      .map((s) => s.senderId)
      .filter((id) => id !== opts.excludeUserId)
      .map((userId) =>
        sendPush(userId, {
          title: "New message",
          body: opts.preview,
          url: `/properties/${opts.propertyId}/messages?thread=${opts.threadId}`,
          tag: `thread-${opts.threadId}`,
        }),
      ),
  );
}

export async function listThreadMessages(threadId: string) {
  await requireUser(); // RLS does the property scoping
  return db
    .select()
    .from(messages)
    .where(eq(messages.threadId, threadId))
    .orderBy(asc(messages.createdAt));
}
