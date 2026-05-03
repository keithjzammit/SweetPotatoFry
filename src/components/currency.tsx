import { formatEuro, type Cents, type Locale } from "@/lib/money";
import { cn } from "@/lib/cn";

export function Currency({
  cents,
  locale = "en",
  className,
}: {
  cents: Cents | number;
  locale?: Locale;
  className?: string;
}) {
  return <span className={cn("tabular", className)}>{formatEuro(cents, locale)}</span>;
}
