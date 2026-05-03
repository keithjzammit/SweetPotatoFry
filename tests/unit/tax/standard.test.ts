import { describe, expect, test } from "vitest";
import { toCents } from "@/lib/money";
import { standardTaxableBase } from "@/lib/tax/standard";

describe("standard rates", () => {
  test("subtracts allowed deductions, then 20% maintenance allowance", () => {
    const r = standardTaxableBase({
      grossRentCents: toCents(12_000),
      loanInterestCents: toCents(2000),
      groundRentCents: toCents(100),
      licenceFeesCents: toCents(150),
    });
    // deductions: 2000 + 100 + 150 = 2250
    // net before maintenance: 12000 - 2250 = 9750
    // maintenance allowance (20%): 1950
    // taxable base: 9750 - 1950 = 7800
    expect(r.deductionsCents).toBe(toCents(2250));
    expect(r.netBeforeMaintenanceCents).toBe(toCents(9750));
    expect(r.maintenanceAllowanceCents).toBe(toCents(1950));
    expect(r.taxableBaseCents).toBe(toCents(7800));
  });

  test("zero deductions still applies 20% maintenance", () => {
    const r = standardTaxableBase({ grossRentCents: toCents(10_000) });
    expect(r.deductionsCents).toBe(0);
    expect(r.maintenanceAllowanceCents).toBe(toCents(2000));
    expect(r.taxableBaseCents).toBe(toCents(8000));
  });

  test("deductions exceeding gross → zero base, never negative", () => {
    const r = standardTaxableBase({
      grossRentCents: toCents(1000),
      loanInterestCents: toCents(2000),
    });
    expect(r.netBeforeMaintenanceCents).toBe(0);
    expect(r.taxableBaseCents).toBe(0);
  });
});
