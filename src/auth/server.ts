import "server-only";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getServerSupabase } from "./supabase-server";

export type Role = "owner" | "co_owner" | "manager";

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  locale: "en" | "es";
};

// Returns the signed-in user's app row, or null if not signed in / not yet
// bootstrapped. Bootstrap (first sign-in → insert into public.users) happens
// in the auth callback handler.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const rows = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    locale: row.locale,
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/sign-in");
  return u;
}

export async function requireRole(roles: Role[]): Promise<CurrentUser> {
  const u = await requireUser();
  if (!roles.includes(u.role)) redirect("/dashboard");
  return u;
}

// Defence-in-depth check before any property-scoped server action runs.
// Returns the user (the action body still uses the RLS-bound client for the
// actual DB read/write, so even if this check were skipped, RLS would block).
export async function requirePropertyAccess(propertyId: string): Promise<CurrentUser> {
  const u = await requireUser();
  const supabase = await getServerSupabase();
  // RLS allows SELECT on properties only if the user has any access path.
  const { data, error } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .maybeSingle();
  if (error || !data) redirect("/dashboard");
  return u;
}
