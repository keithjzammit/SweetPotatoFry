import "server-only";
import webpush from "web-push";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, type PushSubscriptionJson } from "@/db/schema";

const PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:hello@example.com";

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!PUBLIC || !PRIVATE) return false;
  webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

// Sends to every subscription this user has. Drops dead subscriptions on 404/410.
export async function sendPush(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return;

  const userRow = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!userRow || userRow.pushSubscriptions.length === 0) return;

  const stillAlive: PushSubscriptionJson[] = [];
  await Promise.all(
    userRow.pushSubscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, JSON.stringify(payload));
        stillAlive.push(sub);
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status !== 404 && status !== 410) {
          // Unknown error; keep the sub but log.
          console.error("[push] send failed", status, err);
          stillAlive.push(sub);
        }
        // 404/410 → drop subscription.
      }
    }),
  );

  if (stillAlive.length !== userRow.pushSubscriptions.length) {
    await db.update(users).set({ pushSubscriptions: stillAlive }).where(eq(users.id, userId));
  }
}
