import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/auth/server";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

export async function GET(req: NextRequest) {
  await requireUser();
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "google_oauth_not_configured" }, { status: 503 });
  }
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${baseUrl}/api/google/callback`,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES.join(" "),
  });
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
