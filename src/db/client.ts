import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Postgres connection. Supabase pooled URL (DATABASE_URL) is correct for
// serverless. DIRECT_URL is reserved for migrations / drizzle-kit.

const connectionString = process.env.DATABASE_URL;
if (!connectionString && process.env.NODE_ENV === "production") {
  // Fail loud in prod; tolerate missing in dev so first boot doesn't crash.
  throw new Error("DATABASE_URL is required in production");
}

const client = connectionString
  ? postgres(connectionString, { prepare: false, max: 10 })
  : null;

// Lazy proxy so importing this module doesn't crash when the DB is absent.
export const db = client
  ? drizzle(client, { schema })
  : (new Proxy(
      {},
      {
        get() {
          throw new Error(
            "DATABASE_URL is not set — DB calls are unavailable. Set it in .env.local.",
          );
        },
      },
    ) as ReturnType<typeof drizzle<typeof schema>>);

export { schema };
