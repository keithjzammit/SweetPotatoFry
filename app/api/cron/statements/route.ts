import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { statements } from "@/db/schema";
import { buildStatementsForMonth, renderStatementHtml } from "@/lib/statements";
import { uploadFile } from "@/lib/blob";
import { sendStatementEmail } from "@/lib/email";

// Runs on the 1st of every month. Generates the previous month's statement
// for each co-owner, stores the HTML in Vercel Blob, persists the URL, emails.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // Previous month, anchored on UTC.
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const month = { year: target.getUTCFullYear(), month: target.getUTCMonth() + 1 };

  const built = await buildStatementsForMonth(month);
  let issued = 0;
  for (const s of built) {
    const dup = await db
      .select({ id: statements.id })
      .from(statements)
      .where(
        and(
          eq(statements.coOwnerId, s.coOwnerId),
          eq(statements.year, month.year),
          eq(statements.month, month.month),
        ),
      )
      .limit(1);
    if (dup.length > 0) continue;

    const html = renderStatementHtml(s);
    const file = new File([html], `statement.html`, { type: "text/html" });
    const { url } = await uploadFile({
      kind: "statement",
      file,
      ownerId: `${s.coOwnerId}/${month.year}-${pad(month.month)}`,
    });
    await db.insert(statements).values({
      coOwnerId: s.coOwnerId,
      year: month.year,
      month: month.month,
      htmlUrl: url,
      totalShareCents: s.totalShareCents,
    });
    await sendStatementEmail({
      to: s.coOwnerEmail,
      monthLabel: `${month.year}-${pad(month.month)}`,
      url,
    });
    issued++;
  }

  return NextResponse.json({ ok: true, month, issued });
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
