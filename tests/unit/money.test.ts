import { describe, expect, test } from "vitest";
import { addCents, formatEuro, mulCents, subCents, toCents } from "@/lib/money";

describe("money", () => {
  test("toCents rounds to nearest", () => {
    // 1.005 binary-float is ~1.00499..., so Math.round → 100. This is exactly
    // why we store cents — never multiply floats at boundaries downstream.
    expect(toCents(1.005)).toBe(100);
    expect(toCents(1.006)).toBe(101);
    expect(toCents(1.004)).toBe(100);
  });

  test("addCents sums without float drift", () => {
    expect(addCents(toCents(0.1), toCents(0.2))).toBe(30);
  });

  test("subCents preserves cents", () => {
    expect(subCents(toCents(10), toCents(0.01))).toBe(999);
  });

  test("mulCents rounds", () => {
    expect(mulCents(toCents(100), 0.15)).toBe(1500);
  });

  test("formatEuro en uses MT formatting", () => {
    // en-MT renders as "€1,234.56"
    expect(formatEuro(toCents(1234.56), "en")).toMatch(/€/);
  });

  test("formatEuro es uses comma decimal", () => {
    const out = formatEuro(toCents(1234.56), "es");
    expect(out).toContain(",");
  });
});
