import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";

// Minimal Google Calendar v3 client. Uses stored refresh token to mint short
// access tokens on demand.
//
// Per spec §8 we never two-way sync. We only:
// - create a calendar event for a new work
// - delete that event when the work is cancelled
//
// Google connection is OPTIONAL — every export here returns null/no-op when
// the user hasn't connected (no refresh_token stored).

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

async function getRefreshToken(userId: string): Promise<string | null> {
  const row = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  return row?.googleRefreshToken ?? null;
}

async function getAccessToken(refreshToken: string): Promise<string | null> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    console.error("[google] token refresh failed", res.status, await res.text());
    return null;
  }
  const json = (await res.json()) as { access_token?: string };
  return json.access_token ?? null;
}

export async function pushWorkToGoogleCalendar(opts: {
  userId: string;
  work: {
    id: string;
    title: string;
    description: string;
    start: Date;
    end: Date;
  };
}): Promise<string | null> {
  const refresh = await getRefreshToken(opts.userId);
  if (!refresh) return null;
  const access = await getAccessToken(refresh);
  if (!access) return null;

  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      summary: opts.work.title,
      description: opts.work.description,
      start: { dateTime: opts.work.start.toISOString() },
      end: { dateTime: opts.work.end.toISOString() },
      source: { title: "SweetPotatoFry", url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/works/${opts.work.id}` },
    }),
  });
  if (!res.ok) {
    console.error("[google] event create failed", res.status, await res.text());
    return null;
  }
  const json = (await res.json()) as { id: string };
  return json.id;
}

export async function deleteWorkFromGoogleCalendar(opts: {
  userId: string;
  eventId: string;
}): Promise<void> {
  const refresh = await getRefreshToken(opts.userId);
  if (!refresh) return;
  const access = await getAccessToken(refresh);
  if (!access) return;
  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${opts.eventId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${access}` } },
  );
}
