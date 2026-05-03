import type { Locale } from "@/lib/money";

// Spec §5: DD/MM/YYYY everywhere, both locales.
export function FormattedDate({
  value,
  locale = "en",
}: {
  value: Date | string | number;
  locale?: Locale;
}) {
  const d = value instanceof Date ? value : new Date(value);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  // Locale arg reserved for future variants; format is identical for en/es per spec.
  void locale;
  return (
    <time dateTime={d.toISOString().slice(0, 10)} className="tabular">
      {`${dd}/${mm}/${yyyy}`}
    </time>
  );
}
