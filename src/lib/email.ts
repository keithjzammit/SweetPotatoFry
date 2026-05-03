import "server-only";
import { ServerClient } from "postmark";

const POSTMARK_TOKEN = process.env.POSTMARK_SERVER_TOKEN;
const FROM = process.env.POSTMARK_FROM_EMAIL ?? "hello@example.com";

let client: ServerClient | null = null;
function getClient(): ServerClient | null {
  if (!POSTMARK_TOKEN) return null;
  if (!client) client = new ServerClient(POSTMARK_TOKEN);
  return client;
}

type SendArgs = { to: string; subject: string; htmlBody: string; textBody: string };

async function send({ to, subject, htmlBody, textBody }: SendArgs) {
  const c = getClient();
  if (!c) {
    // Postmark not configured — log to stdout so dev still gets feedback.
    console.warn("[email:stub]", { to, subject, textBody });
    return;
  }
  await c.sendEmail({
    From: FROM,
    To: to,
    Subject: subject,
    HtmlBody: htmlBody,
    TextBody: textBody,
    MessageStream: "outbound",
  });
}

// --- Templates -----------------------------------------------------------

export async function sendInviteEmail(args: {
  to: string;
  role: "owner" | "co_owner" | "manager";
  inviterName: string;
  acceptUrl: string;
}) {
  const roleLabel =
    args.role === "co_owner" ? "co-owner" : args.role === "manager" ? "property manager" : "owner";
  const subject = `${args.inviterName} invited you to SweetPotatoFry`;
  const text = `${args.inviterName} has invited you as a ${roleLabel}.\n\nAccept your invite:\n${args.acceptUrl}\n\nThis link expires in 14 days.`;
  const html = `<p>${escape(args.inviterName)} has invited you as a <strong>${escape(roleLabel)}</strong>.</p>
<p><a href="${args.acceptUrl}">Accept your invite</a></p>
<p>This link expires in 14 days.</p>`;
  await send({ to: args.to, subject, htmlBody: html, textBody: text });
}

export async function sendApprovalRequestEmail(args: {
  to: string;
  propertyName: string;
  amountDisplay: string;
  description: string;
  approveUrl: string;
}) {
  const subject = `Approval needed: ${args.amountDisplay} for ${args.propertyName}`;
  const text = `An expense awaiting your approval:\n\nProperty: ${args.propertyName}\nAmount: ${args.amountDisplay}\nDescription: ${args.description}\n\nReview: ${args.approveUrl}`;
  const html = `<p>An expense awaiting your approval:</p>
<ul>
  <li><strong>Property:</strong> ${escape(args.propertyName)}</li>
  <li><strong>Amount:</strong> ${escape(args.amountDisplay)}</li>
  <li><strong>Description:</strong> ${escape(args.description)}</li>
</ul>
<p><a href="${args.approveUrl}">Review</a></p>`;
  await send({ to: args.to, subject, htmlBody: html, textBody: text });
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
