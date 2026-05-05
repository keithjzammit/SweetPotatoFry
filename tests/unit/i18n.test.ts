import { describe, expect, test } from "vitest";
import { isLocale } from "@/i18n/config";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";

describe("i18n", () => {
  test("isLocale narrows correctly", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("es")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale("")).toBe(false);
  });

  test("EN and ES bundles share the same key shape", () => {
    expect(flatKeys(en).sort()).toEqual(flatKeys(es).sort());
  });

  test("nav keys exist in both bundles", () => {
    expect((en.nav as Record<string, string>).dashboard).toBeTruthy();
    expect((es.nav as Record<string, string>).dashboard).toBeTruthy();
  });
});

function flatKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") out.push(...flatKeys(v as Record<string, unknown>, path));
    else out.push(path);
  }
  return out;
}
