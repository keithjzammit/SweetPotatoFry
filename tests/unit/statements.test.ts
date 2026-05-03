import { describe, expect, test } from "vitest";
import { renderStatementHtml, type Statement } from "@/lib/statements-render";
import { toCents } from "@/lib/money";

const sample: Statement = {
  coOwnerId: "u1",
  coOwnerName: "Anna",
  coOwnerEmail: "anna@example.com",
  month: { year: 2026, month: 4 },
  lines: [
    {
      propertyName: "Block 5, Apt 3",
      grossRentCents: toCents(2000),
      netTaxCents: toCents(300),
      approvedExpensesCents: toCents(100),
      distributableCents: toCents(1600),
      shareBps: 5000,
      shareCents: toCents(800),
    },
  ],
  totalShareCents: toCents(800),
};

describe("statement renderer", () => {
  test("includes co-owner name and month label", () => {
    const html = renderStatementHtml(sample);
    expect(html).toContain("Anna");
    expect(html).toContain("April 2026");
  });

  test("renders the property line and the total in tabular money", () => {
    const html = renderStatementHtml(sample);
    expect(html).toContain("Block 5, Apt 3");
    // €800.00 share appears twice: line + footer total
    const matches = html.match(/€800\.00/g);
    expect(matches?.length).toBeGreaterThanOrEqual(2);
  });

  test("escapes HTML in names", () => {
    const evil = { ...sample, coOwnerName: "Anna <script>" };
    const html = renderStatementHtml(evil);
    expect(html).toContain("Anna &lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});
