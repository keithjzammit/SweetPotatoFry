import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

function ensureConfigured() {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    throw new Error(
      "Supabase env not set. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
    );
  }
}

// Per-request RLS-bound client. Uses anon key + the user's session cookie,
// so DB queries are filtered by RLS policies for the signed-in user.
export async function getServerSupabase() {
  ensureConfigured();
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL!, SUPABASE_ANON!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet: { name: string; value: string; options: Record<string, unknown> }[]) => {
        for (const { name, value, options } of toSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}

// Service-role client. Bypasses RLS. Use only inside trusted server actions
// for operations that have already been authorized at the application layer
// (e.g. inserting an audit log row, accepting an invite, bootstrapping a
// freshly signed-up user's row).
export async function getServiceSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    throw new Error(
      "Service role not configured. Set SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
  }
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
