import { requireUser } from "@/auth/server";
import { PushEnable } from "@/components/push-enable";

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Profile</h2>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted-foreground">Name</dt>
          <dd>{user.name ?? "—"}</dd>
          <dt className="text-muted-foreground">Email</dt>
          <dd>{user.email}</dd>
          <dt className="text-muted-foreground">Role</dt>
          <dd>{user.role}</dd>
          <dt className="text-muted-foreground">Locale</dt>
          <dd>{user.locale}</dd>
        </dl>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold">Push notifications</h2>
        <p className="text-xs text-muted-foreground">
          Receive alerts for messages, approvals, and rent confirmations.
        </p>
        <PushEnable />
      </div>
    </section>
  );
}
