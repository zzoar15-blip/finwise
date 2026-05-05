/**
 * Future value of end-of-period monthly contributions (ordinary annuity).
 * FV = PMT × [((1 + r)^n − 1) / r]; r = annualRatePct/100/12.
 */
export function futureValueMonthlyContributions(
  monthlyContribution: number,
  annualRatePct: number,
  months: number,
): number {
  const pmt = Math.max(0, monthlyContribution);
  const n = Math.max(0, Math.floor(months));
  if (pmt <= 0 || n === 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (Math.abs(r) < 1e-14) return pmt * n;
  const factor = (Math.pow(1 + r, n) - 1) / r;
  return pmt * factor;
}
