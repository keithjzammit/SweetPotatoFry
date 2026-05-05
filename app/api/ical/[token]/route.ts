import { NextResponse } from "next/server";
import { and, eq, gte, isNotNull, or } from "drizzle-orm";
import { db } from "@/db/client";
import { leases, properties, users, works } from "@/db/schema";
import { buildIcs } from "@/lib/ics";

// Public iCal feed (spec §8). Auth via per-user token in the URL.
// Returns all in-progress / scheduled / done works for properties the user
// has access to (owner OR active manager).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 401 });

  const userRow = (
    await db.select().from(users).where(eq(users.icalToken, token)).limit(1)
  )[0];
  if (!userRow) return NextResponse.json({ error: "invalid_token" }, { status: 401 });

  // Pull works for properties the user owns OR is an active manager of.
  // We do this in two queries and union in JS — RLS doesn't apply because we
  // hit the DB without an auth context here (this is a service-role read).
  const owned = (
    await db
      .select({ id: properties.id })
      .from(properties)
      .where(eq(properties.ownerId, userRow.id))
  ).map((p) => p.id);
  const managedLeases = await db
    .select({ propertyId: leases.propertyId, endDate: leases.endDate })
    .from(leases)
    .where(eq(leases.managerId, userRow.id));
  const todayIso = new Date().toISOString().slice(0, 10);
  const managed = managedLeases
    .filter((l) => !l.endDate || l.endDate >= todayIso)
    .map((l) => l.propertyId);

  const accessible = Array.from(new Set([...owned, ...managed]));
  if (accessible.length === 0) {
    return new NextResponse(buildIcs({ name: "SweetPotatoFry — Works", events: [] }), {
      headers: icsHeaders(),
    });
  }

  const items = await db
    .select()
    .from(works)
    .where(
      and(
        isNotNull(works.scheduledStart),
        gte(works.scheduledStart, new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)),
        or(...accessible.map((id) => eq(works.propertyId, id))),
      ),
    )
    .limit(500);

  const ics = buildIcs({
    name: "SweetPotatoFry — Works",
    events: items
      .filter((w) => w.scheduledStart)
      .map((w) => ({
        uid: w.id,
        start: w.scheduledStart!,
        end: w.scheduledEnd ?? w.scheduledStart!,
        summary: w.title,
        description: w.description ?? undefined,
      })),
  });

  return new NextResponse(ics, { headers: icsHeaders() });
}

function icsHeaders(): HeadersInit {
  return {
    "content-type": "text/calendar; charset=utf-8",
    "cache-control": "no-store",
  };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
