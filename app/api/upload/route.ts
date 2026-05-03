import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { properties } from "@/db/schema";
import { requireUser } from "@/auth/server";
import { uploadFile, type UploadKind } from "@/lib/blob";

const ALLOWED_KINDS: UploadKind[] = [
  "property-photo",
  "expense-receipt",
  "lease-pdf",
  "work-photo",
];

export async function POST(req: NextRequest) {
  const user = await requireUser();
  const form = await req.formData();
  const kind = form.get("kind");
  const file = form.get("file");
  const propertyId = form.get("propertyId");

  if (typeof kind !== "string" || !ALLOWED_KINDS.includes(kind as UploadKind)) {
    return NextResponse.json({ error: "invalid kind" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (typeof propertyId !== "string") {
    return NextResponse.json({ error: "propertyId required" }, { status: 400 });
  }

  // Verify the user can access the property; RLS would also prevent any
  // subsequent write referencing it, but we want to fail fast before upload.
  const owns = await db
    .select({ id: properties.id })
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);
  if (owns.length === 0) {
    return NextResponse.json({ error: "no access" }, { status: 403 });
  }

  const { url } = await uploadFile({
    kind: kind as UploadKind,
    file,
    ownerId: user.id,
  });
  return NextResponse.json({ url });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
