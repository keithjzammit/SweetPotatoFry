"use server";
import "server-only";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { requireUser } from "@/auth/server";

export async function ensureIcalToken(): Promise<string> {
  const user = await requireUser();
  const row = (await db.select().from(users).where(eq(users.id, user.id)).limit(1))[0];
  if (row?.icalToken) return row.icalToken;
  const token = randomBytes(24).toString("base64url");
  await db.update(users).set({ icalToken: token }).where(eq(users.id, user.id));
  return token;
}

export async function rotateIcalToken(): Promise<string> {
  const user = await requireUser();
  const token = randomBytes(24).toString("base64url");
  await db.update(users).set({ icalToken: token }).where(eq(users.id, user.id));
  return token;
}
