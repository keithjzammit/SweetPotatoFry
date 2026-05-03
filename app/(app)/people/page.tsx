import { isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { invites, properties, users } from "@/db/schema";
import { requireRole } from "@/auth/server";
import { InviteForm } from "./invite-form";
import { FormattedDate } from "@/components/date";

export default async function PeoplePage() {
  await requireRole(["owner"]);

  const team = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users);
  const pending = await db
    .select({
      id: invites.id,
      email: invites.email,
      role: invites.role,
      expiresAt: invites.expiresAt,
      createdAt: invites.createdAt,
    })
    .from(invites)
    .where(isNull(invites.acceptedAt));

  const props = await db
    .select({ id: properties.id, name: properties.name })
    .from(properties)
    .where(isNull(properties.archivedAt));

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">People</h1>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Team</h2>
        <ul className="mt-2 divide-y text-sm">
          {team.map((u) => (
            <li key={u.id} className="flex items-center justify-between py-2">
              <span>{u.name ?? u.email}</span>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {u.role}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold">Invite</h2>
        <InviteForm properties={props} />
      </div>

      {pending.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold">Pending invites</h2>
          <ul className="mt-2 divide-y text-sm">
            {pending.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <span>{p.email}</span>
                <span className="text-xs text-muted-foreground">
                  {p.role} · expires <FormattedDate value={p.expiresAt} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
