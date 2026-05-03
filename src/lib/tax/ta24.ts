// Spec §5: TA24 CSV export. Per property, per tax year, plus a summary row.
//
// Columns (strict order):
//   property_name, address, locality, post_code, type, bedrooms,
//   ll_number, lease_start, lease_end, ha_registered,
//   gross_rent_eur, fwt_15_eur, rebate_band, rebate_amount_eur,
//   net_tax_payable_eur, expenses_logged_eur, distributable_cash_eur,
//   owner_name, owner_share_pct, owner_share_eur

import { stringify } from "csv-stringify/sync";
import { fromCents } from "@/lib/money";
import { fwtNetTax } from "./fwt";

export type Ta24PropertyRow = {
  propertyName: string;
  address: string;
  locality: string;
  postCode: string;
  type: string;
  bedrooms: number;
  leaseLlNumber: string | null;
  leaseStart: string | null;
  leaseEnd: string | null;
  haRegistered: boolean;
  grossRentCents: number;
  rebateBandLabel: string | null;
  rebateCents: number;
  expensesLoggedCents: number;
  // Splits at year-end (or first-of-year per owner; Phase 1 takes the most recent
  // effective split as the representative).
  splits: Array<{ ownerName: string; bps: number }>;
};

const HEADERS = [
  "property_name",
  "address",
  "locality",
  "post_code",
  "type",
  "bedrooms",
  "ll_number",
  "lease_start",
  "lease_end",
  "ha_registered",
  "gross_rent_eur",
  "fwt_15_eur",
  "rebate_band",
  "rebate_amount_eur",
  "net_tax_payable_eur",
  "expenses_logged_eur",
  "distributable_cash_eur",
  "owner_name",
  "owner_share_pct",
  "owner_share_eur",
];

export function buildTa24Csv(properties: Ta24PropertyRow[]): string {
  const rows: (string | number)[][] = [];

  let totalGross = 0;
  let totalFwt = 0;
  let totalRebate = 0;
  let totalNetTax = 0;
  let totalExpenses = 0;
  let totalDistributable = 0;

  for (const p of properties) {
    const { fwtCents, rebateAppliedCents, netTaxCents } = fwtNetTax({
      grossRentCents: p.grossRentCents,
      rebateCents: p.rebateCents,
    });
    // Spec §5: distributable cash = gross - tax - expenses (informational).
    const distributableCents = p.grossRentCents - netTaxCents - p.expensesLoggedCents;

    totalGross += p.grossRentCents;
    totalFwt += fwtCents;
    totalRebate += rebateAppliedCents;
    totalNetTax += netTaxCents;
    totalExpenses += p.expensesLoggedCents;
    totalDistributable += distributableCents;

    if (p.splits.length === 0) {
      rows.push(propertyRow(p, fwtCents, rebateAppliedCents, netTaxCents, distributableCents, "", 0, 0));
    } else {
      for (const s of p.splits) {
        const shareCents = Math.round((distributableCents * s.bps) / 10000);
        rows.push(
          propertyRow(
            p,
            fwtCents,
            rebateAppliedCents,
            netTaxCents,
            distributableCents,
            s.ownerName,
            s.bps / 100,
            shareCents,
          ),
        );
      }
    }
  }

  // Summary row
  rows.push([
    "TOTAL",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    eur(totalGross),
    eur(totalFwt),
    "",
    eur(totalRebate),
    eur(totalNetTax),
    eur(totalExpenses),
    eur(totalDistributable),
    "",
    "",
    "",
  ]);

  return stringify([HEADERS, ...rows], {
    quoted_string: true,
    record_delimiter: "\n",
  });
}

function propertyRow(
  p: Ta24PropertyRow,
  fwtCents: number,
  rebateCents: number,
  netTaxCents: number,
  distributableCents: number,
  ownerName: string,
  sharePct: number,
  shareCents: number,
): (string | number)[] {
  return [
    p.propertyName,
    p.address,
    p.locality,
    p.postCode,
    p.type,
    p.bedrooms,
    p.leaseLlNumber ?? "",
    p.leaseStart ?? "",
    p.leaseEnd ?? "",
    p.haRegistered ? "Y" : "N",
    eur(p.grossRentCents),
    eur(fwtCents),
    p.rebateBandLabel ?? "",
    eur(rebateCents),
    eur(netTaxCents),
    eur(p.expensesLoggedCents),
    eur(distributableCents),
    ownerName,
    sharePct.toFixed(2),
    eur(shareCents),
  ];
}

function eur(cents: number): string {
  return fromCents(cents).toFixed(2);
}
