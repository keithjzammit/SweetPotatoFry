import "server-only";
import { createHash, randomBytes } from "node:crypto";

// Token format: 32 random bytes, base64url. We store the SHA-256 hash so a DB
// leak doesn't expose live invite links. Validity window enforced by the row's
// expires_at column.

export function generateInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  return { token, tokenHash };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function inviteAcceptUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/invite/accept?token=${encodeURIComponent(token)}`;
}
