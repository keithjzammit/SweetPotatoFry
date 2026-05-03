import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Postgres connection. Supabase pooled URL (DATABASE_URL) is correct for
// serverless. DIRECT_URL is reserved for migrations / drizzle-kit.
//
// We resolve lazily so that build-time page collection (which loads modules
// without intending to query) doesn't crash when DATABASE_URL is unset.

type DbInstance = ReturnType<typeof drizzle<typeof schema>>;

let cached: DbInstance | null = null;

function resolveDb(): DbInstance {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Configure it in .env.local for dev or in your Vercel project settings.",
    );
  }
  const client = postgres(url, { prepare: false, max: 10 });
  cached = drizzle(client, { schema });
  return cached;
}

// Proxy that lazily resolves the real client. Importing this module never
// connects; the connection only happens on the first query.
export const db = new Proxy({} as DbInstance, {
  get(_target, prop) {
    const real = resolveDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
});

export { schema };
