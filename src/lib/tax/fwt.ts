// Spec §5: Final Withholding Tax (FWT) at 15%.
// - Calculated on GROSS rent received in the calendar year
// - No deductions allowed
// - Rebate (HA-registered long lease) cannot exceed 15% of rent — i.e. it can
//   zero out the tax but never produce a refund.
//
// All values in cents; result also in cents.

import type { Cents } from "@/lib/money";

export const FWT_RATE = 0.15;

export function fwtBeforeRebate(grossRentCents: Cents | number): number {
  return Math.round((grossRentCents as number) * FWT_RATE);
}

export function fwtNetTax({
  grossRentCents,
  rebateCents,
}: {
  grossRentCents: Cents | number;
  rebateCents: Cents | number;
}): {
  fwtCents: number;
  rebateAppliedCents: number;
  netTaxCents: number;
} {
  const fwtCents = fwtBeforeRebate(grossRentCents);
  // Spec: rebate cannot exceed 15% of rent → cap rebate at fwt amount.
  const rebateAppliedCents = Math.min(rebateCents as number, fwtCents);
  // Net tax floor at 0.
  const netTaxCents = Math.max(0, fwtCents - rebateAppliedCents);
  return { fwtCents, rebateAppliedCents, netTaxCents };
}
