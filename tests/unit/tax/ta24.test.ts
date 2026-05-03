import { describe, expect, test } from "vitest";
import { toCents } from "@/lib/money";
import { buildTa24Csv, type Ta24PropertyRow } from "@/lib/tax/ta24";

const baseProp: Ta24PropertyRow = {
  propertyName: "Block 5, Apt 3",
  address: "Triq il-Kbira",
  locality: "Sliema",
  postCode: "SLM1234",
  type: "apartment",
  bedrooms: 2,
  leaseLlNumber: "LL/12345",
  leaseStart: "2025-01-01",
  leaseEnd: null,
  haRegistered: true,
  grossRentCents: toCents(12_000),
  rebateBandLabel: "2-bed, 5+ years",
  rebateCents: toCents(1600),
  expensesLoggedCents: toCents(1000),
  splits: [
    { ownerName: "Anna", bps: 5000 },
    { ownerName: "Bob", bps: 5000 },
  ],
};

describe("TA24 CSV", () => {
  test("emits headers, per-owner rows, and a summary row", () => {
    const csv = buildTa24Csv([baseProp]);
    const lines = csv.trim().split("\n");
    // headers + 2 owner rows + 1 summary
    expect(lines.length).toBe(4);
    expect(lines[0]).toContain("property_name");
    expect(lines[0]).toContain("owner_share_eur");

    // Owner rows include both names
    expect(csv).toContain("Anna");
    expect(csv).toContain("Bob");

    // Summary row begins with TOTAL
    expect(lines[3]).toMatch(/^"TOTAL"/);
  });

  test("summary totals are correct", () => {
    const csv = buildTa24Csv([baseProp, { ...baseProp, propertyName: "Block 5, Apt 4" }]);
    const lines = csv.trim().split("\n");
    const summary = lines[lines.length - 1]!;
    // gross: 12000 + 12000 = 24000
    expect(summary).toContain('"24000.00"');
    // FWT: 15% of 24000 = 3600
    expect(summary).toContain('"3600.00"');
    // Rebate per property = 1600 (under the 1800 cap), summed = 3200
    expect(summary).toContain('"3200.00"');
    // Net tax = 400 (3600 - 3200)
    expect(summary).toContain('"400.00"');
  });

  test("per-owner share sums to property distributable cash", () => {
    const csv = buildTa24Csv([baseProp]);
    const lines = csv.trim().split("\n");
    // distributable = 12000 (gross) - 200 (net tax) - 1000 (expenses) = 10800
    // each 50% share = 5400.00
    expect(lines[1]).toContain('"5400.00"');
    expect(lines[2]).toContain('"5400.00"');
  });
});
