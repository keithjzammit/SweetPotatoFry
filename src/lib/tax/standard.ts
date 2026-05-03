// Spec §5: Standard rates option.
// Allowed deductions: loan interest, ground rent, licence fees.
// Plus 20% maintenance allowance on net (after the above deductions).
// Repairs and white goods NOT directly deductible under either method.
//
// Returns the taxable base; the tax due itself depends on the owner's
// marginal income tax band, which is OUT OF SCOPE for Phase 1 (we surface
// the taxable base in TA24 and let the owner enter it on their return).

import type { Cents } from "@/lib/money";

export const MAINTENANCE_ALLOWANCE_RATE = 0.2;

export function standardTaxableBase({
  grossRentCents,
  loanInterestCents = 0,
  groundRentCents = 0,
  licenceFeesCents = 0,
}: {
  grossRentCents: Cents | number;
  loanInterestCents?: Cents | number;
  groundRentCents?: Cents | number;
  licenceFeesCents?: Cents | number;
}): {
  deductionsCents: number;
  netBeforeMaintenanceCents: number;
  maintenanceAllowanceCents: number;
  taxableBaseCents: number;
} {
  const deductionsCents =
    (loanInterestCents as number) + (groundRentCents as number) + (licenceFeesCents as number);
  const netBeforeMaintenanceCents = Math.max(0, (grossRentCents as number) - deductionsCents);
  const maintenanceAllowanceCents = Math.round(
    netBeforeMaintenanceCents * MAINTENANCE_ALLOWANCE_RATE,
  );
  const taxableBaseCents = Math.max(0, netBeforeMaintenanceCents - maintenanceAllowanceCents);
  return {
    deductionsCents,
    netBeforeMaintenanceCents,
    maintenanceAllowanceCents,
    taxableBaseCents,
  };
}
