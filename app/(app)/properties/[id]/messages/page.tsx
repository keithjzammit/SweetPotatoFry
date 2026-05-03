import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { messages, users } from "@/db/schema";
import { requirePropertyAccess } from "@/auth/server";
import { getActiveLocale } from "@/i18n/get-messages";
import { ThreadComposer } from "./composer";
import { MessageItem } from "./message-item";

export default async function PropertyMessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ thread?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  await requirePropertyAccess(id);
  const locale = await getActiveLocale();

  // For Phase 1 simplicity: list all messages for this property in one stream;
  // groups by threadId visually. A dedicated thread view is the natural next step.
  const rows = await db
    .select({
      id: messages.id,
      threadId: messages.threadId,
      senderId: messages.senderId,
      senderName: users.name,
      senderEmail: users.email,
      bodyOriginal: messages.bodyOriginal,
      bodyLang: messages.bodyLang,
      bodyTranslatedEn: messages.bodyTranslatedEn,
      bodyTranslatedEs: messages.bodyTranslatedEs,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .leftJoin(users, eq(messages.senderId, users.id))
    .where(eq(messages.propertyId, id))
    .orderBy(asc(messages.createdAt))
    .limit(500);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>

      {rows.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          No messages yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((m) => (
            <MessageItem
              key={m.id}
              message={{
                id: m.id,
                senderName: m.senderName ?? m.senderEmail ?? "Unknown",
                bodyOriginal: m.bodyOriginal,
                bodyLang: m.bodyLang,
                translation: locale === "es" ? m.bodyTranslatedEs : m.bodyTranslatedEn,
                createdAt: m.createdAt.toISOString(),
              }}
              activeLocale={locale}
            />
          ))}
        </ul>
      )}

      <ThreadComposer propertyId={id} threadId={sp.thread} />
    </section>
  );
}
