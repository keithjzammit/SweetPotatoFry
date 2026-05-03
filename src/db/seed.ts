import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DIRECT_URL or DATABASE_URL must be set");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1 });

const seeds = ["maltese-localities.sql", "rebate-bands.sql"];

for (const file of seeds) {
  const content = readFileSync(resolve("seeds", file), "utf8");
  process.stdout.write(`→ seeding ${file} ... `);
  await sql.unsafe(content);
  process.stdout.write("done\n");
}

await sql.end();
