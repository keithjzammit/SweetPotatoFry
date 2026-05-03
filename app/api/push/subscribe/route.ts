import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { users, type PushSubscriptionJson } from "@/db/schema";
import { requireUser } from "@/auth/server";

const SubSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().nullable(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

export async function POST(req: NextRequest) {
  const user = await requireUser();
  const body = await req.json();
  const parsed = SubSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid subscription" }, { status: 400 });
  }
  const sub: PushSubscriptionJson = parsed.data;

  const row = (await db.select().from(users).where(eq(users.id, user.id)).limit(1))[0];
  const existing = row?.pushSubscriptions ?? [];
  // Replace any sub with the same endpoint.
  const next = [...existing.filter((s) => s.endpoint !== sub.endpoint), sub];
  await db.update(users).set({ pushSubscriptions: next }).where(eq(users.id, user.id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await requireUser();
  const { endpoint } = (await req.json()) as { endpoint?: string };
  if (!endpoint) return NextResponse.json({ ok: true });
  const row = (await db.select().from(users).where(eq(users.id, user.id)).limit(1))[0];
  const existing = row?.pushSubscriptions ?? [];
  await db
    .update(users)
    .set({ pushSubscriptions: existing.filter((s) => s.endpoint !== endpoint) })
    .where(eq(users.id, user.id));
  return NextResponse.json({ ok: true });
}
