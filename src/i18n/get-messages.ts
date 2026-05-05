import "server-only";
import { getCurrentUser } from "@/auth/server";
import en from "./messages/en.json";
import es from "./messages/es.json";
import { defaultLocale, type Locale } from "./config";

const BUNDLES: Record<Locale, Record<string, unknown>> = { en, es };

export async function getActiveLocale(): Promise<Locale> {
  const user = await getCurrentUser();
  return user?.locale ?? defaultLocale;
}

export function getMessages(locale: Locale) {
  return BUNDLES[locale];
}

// Lookup helper: t("nav.dashboard"), falling back to the key itself.
export function makeT(locale: Locale) {
  const bundle = BUNDLES[locale] as Record<string, unknown>;
  return (key: string): string => {
    const parts = key.split(".");
    let cur: unknown = bundle;
    for (const p of parts) {
      if (typeof cur !== "object" || cur === null) return key;
      cur = (cur as Record<string, unknown>)[p];
    }
    return typeof cur === "string" ? cur : key;
  };
}
