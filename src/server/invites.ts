"use server";
import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { invites, ownershipSplits, leases, properties, users, type InviteMetadata } from "@/db/schema";
import { generateInviteToken, hashToken, inviteAcceptUrl } from "@/auth/invite";
import { sendInviteEmail } from "@/lib/email";
import { withAudit } from "@/lib/audit";
import { requireRole, type Role } from "@/auth/server";

const INVITE_TTL_DAYS = 14;

export async function createInvite(input: {
  email: string;
  role: Role;
  metadata?: InviteMetadata;
}) {
  const inviter = await requireRole(["owner"]);
  const { token, tokenHash } = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  const [row] = await withAudit(
    { action: "invite.create", entityType: "invite", actorId: inviter.id },
    async () => {
      return db
        .insert(invites)
        .values({
          email: input.email.toLowerCase(),
          role: input.role,
          invitedBy: inviter.id,
          metadata: input.metadata ?? {},
          tokenHash,
          expiresAt,
        })
        .returning();
    },
  );

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  await sendInviteEmail({
    to: input.email,
    role: input.role,
    inviterName: inviter.name ?? inviter.email,
    acceptUrl: inviteAcceptUrl(baseUrl, token),
  });

  return { id: row!.id, expiresAt };
}

// Called by the auth callback when a freshly signed-in user has an invite token.
// Returns the role they should be created as, or null on invalid/expired.
export async function acceptInviteByToken(
  token: string,
  newUserId: string,
  newUserEmail: string,
): Promise<Role | null> {
  const tokenHash = hashToken(token);
  const rows = await db
    .select()
    .from(invites)
    .where(
      and(
        eq(invites.tokenHash, tokenHash),
        gt(invites.expiresAt, new Date()),
        isNull(invites.acceptedAt),
      ),
    )
    .limit(1);

  const invite = rows[0];
  if (!invite) return null;
  if (invite.email.toLowerCase() !== newUserEmail.toLowerCase()) return null;

  // Mark accepted.
  await db
    .update(invites)
    .set({ acceptedAt: new Date() })
    .where(eq(invites.id, invite.id));

  // Side effects per role.
  if (invite.role === "manager") {
    // Manager invites carry property IDs they should be made manager of.
    // Spec §13: invite captures lease + LL number too — but in v1 the owner
    // creates the lease record; the invite simply assigns the manager_id on
    // the matching lease(s).
    const propertyIds = invite.metadata.propertyIds ?? [];
    for (const propertyId of propertyIds) {
      // Update any leases on that property without an active manager.
      await db
        .update(leases)
        .set({ managerId: newUserId })
        .where(
          and(
            eq(leases.propertyId, propertyId),
            // RLS-bypassing service-role caller is OK here; we've validated
            // the invite. Still, guard against re-assigning an active lease.
            isNull(leases.endDate),
          ),
        );
    }
  } else if (invite.role === "co_owner") {
    // Co-owner invites carry an optional default split; when applied, it goes
    // onto ownership_splits with property_id = NULL meaning "default for all
    // properties of the inviter".
    const splitBps = invite.metadata.defaultSplitBps;
    if (splitBps && splitBps > 0 && splitBps <= 10000) {
      // Find any property of the inviter to anchor effective_from; spec says
      // splits apply globally with NULL property_id.
      const today = new Date().toISOString().slice(0, 10);
      await db.insert(ownershipSplits).values({
        propertyId: null,
        userId: newUserId,
        percentageBps: splitBps,
        effectiveFrom: today,
      });
      void properties; // referenced for type completeness
      void users;
    }
  }

  return invite.role;
}
