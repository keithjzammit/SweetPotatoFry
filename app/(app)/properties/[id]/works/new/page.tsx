import { requirePropertyAccess } from "@/auth/server";
import { NewWorkForm } from "./form";

export default async function NewWorkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePropertyAccess(id);
  return (
    <section className="max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Schedule work</h1>
      <p className="text-sm text-muted-foreground">
        Adds to your Google Calendar if connected; otherwise download an .ics file.
      </p>
      <NewWorkForm propertyId={id} />
    </section>
  );
}
