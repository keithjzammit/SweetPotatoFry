import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { requireUser } from "@/auth/server";

export async function GET(req: NextRequest) {
  const user = await requireUser();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/settings?google=missing_code", url.origin));

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      code,
      grant_type: "authorization_code",
      redirect_uri: `${baseUrl}/api/google/callback`,
    }),
  });
  if (!res.ok) {
    return NextResponse.redirect(new URL("/settings?google=token_exchange_failed", url.origin));
  }
  const json = (await res.json()) as { refresh_token?: string };
  if (!json.refresh_token) {
    return NextResponse.redirect(new URL("/settings?google=no_refresh_token", url.origin));
  }
  await db
    .update(users)
    .set({ googleRefreshToken: json.refresh_token })
    .where(eq(users.id, user.id));
  return NextResponse.redirect(new URL("/settings?google=connected", url.origin));
}
