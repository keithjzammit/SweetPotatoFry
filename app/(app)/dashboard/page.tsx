import { requireUser } from "@/auth/server";

export default async function DashboardPage() {
  const user = await requireUser();
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">
        {greeting()}, {user.name?.split(" ")[0] ?? user.email}
      </h1>
      <p className="text-sm text-muted-foreground">
        Role: {humanRole(user.role)}
      </p>
      <div className="mt-6 rounded-lg border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          More dashboard widgets land in slices 4–7.
        </p>
      </div>
    </section>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function humanRole(r: string): string {
  return r === "co_owner" ? "Co-owner" : r.charAt(0).toUpperCase() + r.slice(1);
}
