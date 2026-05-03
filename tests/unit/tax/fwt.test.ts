import { describe, expect, test } from "vitest";
import { toCents } from "@/lib/money";
import { fwtBeforeRebate, fwtNetTax } from "@/lib/tax/fwt";

describe("FWT 15%", () => {
  test("computes 15% of gross", () => {
    expect(fwtBeforeRebate(toCents(10_000))).toBe(toCents(1500));
  });

  test("rebate caps at FWT amount (cannot produce a refund)", () => {
    const r = fwtNetTax({
      grossRentCents: toCents(1000),
      rebateCents: toCents(500), // way above 15% of 1000 (which is 150)
    });
    expect(r.fwtCents).toBe(toCents(150));
    expect(r.rebateAppliedCents).toBe(toCents(150));
    expect(r.netTaxCents).toBe(0);
  });

  test("partial rebate reduces tax pro rata", () => {
    const r = fwtNetTax({
      grossRentCents: toCents(10_000),
      rebateCents: toCents(600),
    });
    expect(r.fwtCents).toBe(toCents(1500));
    expect(r.rebateAppliedCents).toBe(toCents(600));
    expect(r.netTaxCents).toBe(toCents(900));
  });

  test("no rebate → net tax equals FWT", () => {
    const r = fwtNetTax({ grossRentCents: toCents(2400), rebateCents: 0 });
    expect(r.netTaxCents).toBe(toCents(360));
  });

  test("zero gross → zero everything", () => {
    const r = fwtNetTax({ grossRentCents: 0, rebateCents: toCents(100) });
    expect(r.fwtCents).toBe(0);
    expect(r.netTaxCents).toBe(0);
    expect(r.rebateAppliedCents).toBe(0);
  });
});
