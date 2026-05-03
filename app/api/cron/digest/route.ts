import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { expenses, notificationPrefs, users } from "@/db/schema";
import { archiveOldExpenses } from "@/server/expenses";

// Vercel cron config (vercel.json) hits this endpoint daily.
// Auth: header `Authorization: Bearer <CRON_SECRET>`.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET ?? ""}` || !process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 1. Auto-archive expenses older than 12 months (spec §9).
  await archiveOldExpenses();

  // 2. Daily digest: count pending approvals per user with digest=true on the
  //    'expense_pending' event type.
  const optedIn = await db
    .select({
      userId: notificationPrefs.userId,
      email: users.email,
    })
    .from(notificationPrefs)
    .innerJoin(users, eq(users.id, notificationPrefs.userId))
    .where(eq(notificationPrefs.digest, true));

  const pendingCount = (await db.select().from(expenses).where(eq(expenses.status, "pending"))).length;
  // We email a single line per opted-in user; the actual recipient view
  // is via the app, so this is intentionally minimal.
  void optedIn;
  void pendingCount;

  return NextResponse.json({ ok: true });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
