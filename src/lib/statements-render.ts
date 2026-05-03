// Pure HTML renderer for monthly co-owner statements. Kept separate from
// statements.ts so it can be unit-tested without pulling in `server-only`
// or the DB client.

import { fromCents } from "@/lib/money";

export type StatementMonth = { year: number; month: number };

export type StatementLine = {
  propertyName: string;
  grossRentCents: number;
  netTaxCents: number;
  approvedExpensesCents: number;
  distributableCents: number;
  shareBps: number;
  shareCents: number;
};

export type Statement = {
  coOwnerId: string;
  coOwnerName: string;
  coOwnerEmail: string;
  month: StatementMonth;
  lines: StatementLine[];
  totalShareCents: number;
};

export function renderStatementHtml(s: Statement): string {
  const monthLabel = monthName(s.month.year, s.month.month);
  const rows = s.lines
    .map(
      (l) => `
    <tr>
      <td>${escape(l.propertyName)}</td>
      <td class="num">${eur(l.grossRentCents)}</td>
      <td class="num">${eur(l.netTaxCents)}</td>
      <td class="num">${eur(l.approvedExpensesCents)}</td>
      <td class="num">${eur(l.distributableCents)}</td>
      <td class="num">${(l.shareBps / 100).toFixed(2)}%</td>
      <td class="num"><strong>${eur(l.shareCents)}</strong></td>
    </tr>`,
    )
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Statement — ${monthLabel}</title>
<style>
  body { font-family: -apple-system, system-ui, Arial, sans-serif; color: #1c2024; padding: 24px; max-width: 720px; margin: 0 auto; }
  h1 { font-size: 18px; font-weight: 600; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; margin-top: 16px; }
  th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
  th { font-weight: 600; color: #6b7280; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  tfoot td { font-weight: 600; border-top: 2px solid #1c2024; border-bottom: none; }
</style>
</head>
<body>
  <h1>Monthly statement — ${monthLabel}</h1>
  <p>For ${escape(s.coOwnerName)} · ${escape(s.coOwnerEmail)}</p>
  <table>
    <thead>
      <tr>
        <th>Property</th>
        <th class="num">Gross rent</th>
        <th class="num">FWT 15%</th>
        <th class="num">Approved expenses</th>
        <th class="num">Distributable</th>
        <th class="num">Share</th>
        <th class="num">Your share</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr><td colspan="6">Total</td><td class="num">${eur(s.totalShareCents)}</td></tr>
    </tfoot>
  </table>
  <p style="font-size: 11px; color: #6b7280; margin-top: 24px;">
    Rebates not applied at the monthly view; the annual TA24 export reconciles them.
  </p>
</body>
</html>`;
}

function eur(cents: number): string {
  return `€${fromCents(cents).toFixed(2)}`;
}
function monthName(y: number, m: number): string {
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-MT", { month: "long", year: "numeric" });
}
function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
