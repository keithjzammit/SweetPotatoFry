import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getServerSupabase, getServiceSupabase } from "@/auth/supabase-server";
import { acceptInviteByToken } from "@/server/invites";

// Supabase Auth redirects here after OAuth. We exchange the `code` for a
// session, then bootstrap the public.users row on first sign-in (or accept
// a pending invite if `?invite=<token>` is present).
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const inviteToken = url.searchParams.get("invite");
  const next = url.searchParams.get("next") ?? "/dashboard";

  if (!code) return NextResponse.redirect(new URL("/sign-in?error=missing_code", url.origin));

  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/sign-in?error=${encodeURIComponent(error.message)}`, url.origin),
    );
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.redirect(new URL("/sign-in?error=no_user", url.origin));

  const existing = await db.select().from(users).where(eq(users.id, authUser.id)).limit(1);

  if (existing.length === 0) {
    // First time: bootstrap a row. Role decided by invite (if present) else
    // first user becomes owner; subsequent users without invite redirect to
    // a "needs invite" page.
    const role = inviteToken
      ? await acceptInviteByToken(inviteToken, authUser.id, authUser.email ?? "")
      : (await isFirstEverUser())
        ? "owner"
        : null;

    if (!role) {
      // Sign them out — they can't proceed without an invite.
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/sign-in?error=needs_invite", url.origin));
    }

    const service = await getServiceSupabase();
    await service.from("users").insert({
      id: authUser.id,
      email: authUser.email ?? "",
      name: authUser.user_metadata?.full_name ?? null,
      role,
      locale: "en",
    });
  } else if (inviteToken) {
    // Existing user accepting an additional invite (e.g. owner invited as
    // co-owner of someone else's property). Currently a no-op; spec doesn't
    // describe multi-role users for Phase 1.
  }

  return NextResponse.redirect(new URL(next, url.origin));
}

async function isFirstEverUser(): Promise<boolean> {
  const any = await db.select({ id: users.id }).from(users).limit(1);
  return any.length === 0;
}
