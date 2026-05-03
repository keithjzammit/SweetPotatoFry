"use server";
import "server-only";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { requireUser } from "@/auth/server";
import { withAudit } from "@/lib/audit";

const Input = z.object({
  locale: z.enum(["en", "es"]),
});

export async function setLocale(input: z.infer<typeof Input>) {
  const user = await requireUser();
  const data = Input.parse(input);
  await withAudit(
    { action: "profile.set_locale", entityType: "user", actorId: user.id, payload: data },
    async () =>
      db.update(users).set({ locale: data.locale }).where(eq(users.id, user.id)).returning(),
  );
  revalidatePath("/settings");
}
