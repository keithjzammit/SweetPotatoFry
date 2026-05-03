// All monetary values are stored as integer cents to avoid float drift.
// Spec §5: "All amounts stored as integer cents to avoid float errors".

export type Cents = number & { readonly __brand: "Cents" };

export function toCents(euros: number): Cents {
  return Math.round(euros * 100) as Cents;
}

export function fromCents(cents: Cents | number): number {
  return cents / 100;
}

export function addCents(...values: Array<Cents | number>): Cents {
  return values.reduce<number>((sum, v) => sum + v, 0) as Cents;
}

export function subCents(a: Cents | number, b: Cents | number): Cents {
  return (a - b) as Cents;
}

export function mulCents(c: Cents | number, multiplier: number): Cents {
  return Math.round(c * multiplier) as Cents;
}

export type Locale = "en" | "es";

const FORMATTERS: Record<Locale, Intl.NumberFormat> = {
  // Spec §5: en uses period decimal, es uses comma decimal. Both display €.
  en: new Intl.NumberFormat("en-MT", { style: "currency", currency: "EUR" }),
  es: new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }),
};

export function formatEuro(cents: Cents | number, locale: Locale = "en"): string {
  return FORMATTERS[locale].format(fromCents(cents));
}
