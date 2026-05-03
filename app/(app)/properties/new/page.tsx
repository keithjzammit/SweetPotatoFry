import { db } from "@/db/client";
import { malteseLocalities } from "@/db/schema";
import { requireRole } from "@/auth/server";
import { NewPropertyForm } from "./form";

export default async function NewPropertyPage() {
  await requireRole(["owner"]);
  const localities = await db
    .select({ id: malteseLocalities.id, nameEn: malteseLocalities.nameEn })
    .from(malteseLocalities);
  localities.sort((a, b) => a.nameEn.localeCompare(b.nameEn));
  return (
    <section className="max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">New property</h1>
      <NewPropertyForm localities={localities} />
    </section>
  );
}
