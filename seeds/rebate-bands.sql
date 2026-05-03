-- TODO(cfr-rates): These are PLACEHOLDER values. Real CfR-published rebate
-- bands change yearly; replace with the official scheme amounts before
-- any TA24 export goes to a tax-paying user.
--
-- Spec §5: rebate cannot exceed 15% of rent for the year. The cap is enforced
-- in src/lib/tax/fwt.ts; this table only stores the gross annual rebate the
-- band would otherwise grant.
--
-- Bands are matched as: (bedrooms = X, lease_duration_years >= min_duration_years).
-- Take the row with the largest min_duration_years that still satisfies.

INSERT INTO public.rebate_bands (bedrooms, min_duration_years, annual_rebate_cents, effective_from) VALUES
  (1, 1, 30000,  '2024-01-01'),  -- 1-bed,  1+ years   → €300
  (1, 2, 60000,  '2024-01-01'),  -- 1-bed,  2+ years   → €600
  (1, 5, 120000, '2024-01-01'),  -- 1-bed,  5+ years   → €1200
  (2, 1, 40000,  '2024-01-01'),  -- 2-bed,  1+ years   → €400
  (2, 2, 80000,  '2024-01-01'),  -- 2-bed,  2+ years   → €800
  (2, 5, 160000, '2024-01-01'),  -- 2-bed,  5+ years   → €1600
  (3, 1, 50000,  '2024-01-01'),
  (3, 2, 100000, '2024-01-01'),
  (3, 5, 200000, '2024-01-01'),
  (4, 1, 60000,  '2024-01-01'),
  (4, 2, 120000, '2024-01-01'),
  (4, 5, 240000, '2024-01-01')
ON CONFLICT (bedrooms, min_duration_years, effective_from) DO NOTHING;
