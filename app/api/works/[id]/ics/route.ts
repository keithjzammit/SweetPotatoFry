import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { works } from "@/db/schema";
import { requireUser } from "@/auth/server";
import { buildIcs } from "@/lib/ics";

// .ics download for a single work (spec §8 fallback when Google Calendar is
// not connected). RLS via the user's access to the underlying property handled
// implicitly by drizzle going through the per-request auth context.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const { id } = await params;
  const work = (await db.select().from(works).where(eq(works.id, id)).limit(1))[0];
  if (!work || !work.scheduledStart) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const ics = buildIcs({
    name: work.title,
    events: [
      {
        uid: work.id,
        start: work.scheduledStart,
        end: work.scheduledEnd ?? work.scheduledStart,
        summary: work.title,
        description: work.description ?? undefined,
      },
    ],
  });
  return new NextResponse(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${slug(work.title)}.ics"`,
    },
  });
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "work";
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
