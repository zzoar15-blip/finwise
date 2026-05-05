'use client';

import { useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Home, ChevronLeft } from 'lucide-react';
import { useFinWiseStore } from '@/lib/store';
import { usePlanStore } from '@/lib/planStore';
import { getPropertyTaxRate } from '@/lib/stateTax';
import { formatCurrency } from '@/lib/format';
import { ExportButton } from '@/components/ExportButton';
import { downloadCsv } from '@/lib/export';
import { exportDomToPdf } from '@/lib/exportPdf';
import { Button } from '@/components/ui/button';

const SENTIMENT_STYLES = {
  'strong-buy': 'bg-[#0f172a] text-white',
  'lean-buy': 'bg-[#2563eb] text-white',
  neutral: 'bg-gray-100 text-gray-900',
  'lean-rent': 'bg-amber-200 text-amber-950',
  'strong-rent': 'bg-gray-900 text-white',
} as const;

function yTick(v: number) {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(0)}k`;
  return `$${Math.round(v)}`;
}

function pickWinnerLabel(diff: number) {
  if (Math.abs(diff) < 5000) return 'Too close to call';
  return diff > 0 ? `Buying wins by ${formatCurrency(Math.abs(diff))}` : `Renting wins by ${formatCurrency(Math.abs(diff))}`;
}

function buildProfileDefaults(params: {
  paycheckState?: string;
  paycheckFiling?: string;
  paycheckMarginal?: number;
  budgetHousing?: number;
  homeTarget?: number;
}) {
  const state = params.paycheckState || 'Massachusetts';
  const defaultDownPaymentPct = 0.2;
  const derivedPurchasePrice =
    params.homeTarget && params.homeTarget > 0
      ? params.homeTarget / defaultDownPaymentPct
      : 600000;
  return {
    // `homeTarget` from onboarding is a down-payment goal, not full home price.
    purchasePrice: derivedPurchasePrice,
    downPaymentPct: defaultDownPaymentPct,
    mortgageRate: 0.065,
    loanTermYears: 30,
    annualPropertyTaxRate: getPropertyTaxRate(state),
    annualAppreciationRate: 0.035,
    annualMaintenancePct: 0.01,
    hoaMonthly: 0,
    closingCostPct: 0.03,
    sellingCostPct: 0.06,
    pmiRate: 0.008,
    monthlyRent: params.budgetHousing || 3000,
    annualRentIncrease: 0.03,
    rentersInsuranceMonthly: 15,
    investmentReturnRate: 0.07,
    marginalTaxRate: params.paycheckMarginal || 0.28,
    filingStatus: params.paycheckFiling || 'single',
    itemizeDeductions: false,
    plannedStayYears: 7,
    state,
  };
}

export default function RentVsBuyPage() {
  const paycheckResults = useFinWiseStore((s) => s.paycheckResults);
  const paycheckInputs = useFinWiseStore((s) => s.paycheckInputs);
  const budgetInputs = useFinWiseStore((s) => s.budgetInputs);
  const rentVsBuyInputs = useFinWiseStore((s) => s.rentVsBuyInputs);
  const rentVsBuyResults = useFinWiseStore((s) => s.rentVsBuyResults);
  const setRentVsBuyInputs = useFinWiseStore((s) => s.setRentVsBuyInputs);
  const plan = usePlanStore((s) => s.plan);
  const migratedLegacyPriceRef = useRef(false);

  useEffect(() => {
    if (rentVsBuyInputs) return;
    setRentVsBuyInputs(
      buildProfileDefaults({
        paycheckState: paycheckInputs?.state,
        paycheckFiling: paycheckInputs?.filingStatus,
        paycheckMarginal: paycheckResults?.marginalCombinedRate,
        budgetHousing: budgetInputs?.housing,
        homeTarget: plan?.inputs?.homeTarget,
      }),
    );
  }, [budgetInputs?.housing, paycheckInputs?.filingStatus, paycheckInputs?.state, paycheckResults?.marginalCombinedRate, plan?.inputs?.homeTarget, rentVsBuyInputs, setRentVsBuyInputs]);

  useEffect(() => {
    if (migratedLegacyPriceRef.current) return;
    if (!rentVsBuyInputs) return;
    const homeTarget = plan?.inputs?.homeTarget;
    if (!homeTarget || homeTarget <= 0) return;

    // Backfill older profiles where purchasePrice was incorrectly set equal to down-payment goal.
    const looksLikeLegacyPrice =
      Math.abs(rentVsBuyInputs.purchasePrice - homeTarget) <= Math.max(1000, homeTarget * 0.02);
    if (!looksLikeLegacyPrice) return;

    migratedLegacyPriceRef.current = true;
    setRentVsBuyInputs({ purchasePrice: homeTarget / 0.2 });
  }, [plan?.inputs?.homeTarget, rentVsBuyInputs, setRentVsBuyInputs]);

  const inputs = rentVsBuyInputs;
  const results = rentVsBuyResults;

  const chartData = useMemo(
    () =>
      (results?.monthlyData ?? []).filter((d) => d.month % 12 === 0).map((d) => ({
        year: d.month / 12,
        buyer: d.buyerNetWorth,
        renter: d.renterNetWorth,
        difference: d.netWorthDifference,
      })),
    [results?.monthlyData],
  );

  const csvRows = useMemo<(string | number)[][]>(() => {
    if (!results) return [];
    return [
      ['Month', 'Year', 'Home Value', 'Mortgage Balance', 'Home Equity', 'Buyer Liquid', 'Buyer Net Worth', 'Buyer Monthly Cost', 'Renter Portfolio', 'Renter Net Worth', 'Renter Monthly Cost', 'Net Worth Difference'],
      ...results.monthlyData.map((m) => [
        m.month,
        Number((m.month / 12).toFixed(2)),
        m.homeValue,
        m.mortgageBalance,
        m.homeEquity,
        m.buyerLiquidPortfolio,
        m.buyerNetWorth,
        m.buyerMonthlyCost,
        m.renterPortfolio,
        m.renterNetWorth,
        m.renterMonthlyCost,
        m.netWorthDifference,
      ]),
    ];
  }, [results]);

  if (!inputs || !results) {
    return <div className="text-sm text-muted-foreground">Loading Rent vs. Buy model...</div>;
  }

  const plannedDiff = results.plannedStayResult.buyerNetWorth - results.plannedStayResult.renterNetWorth;

  return (
    <div id="rent-vs-buy-content" className="space-y-5 max-w-[1400px]">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <Link href="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-3" /> Tools
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Home className="size-6 text-[#1e3a5f]" />
            Rent vs. Buy Calculator
          </h1>
          <p className="text-sm text-muted-foreground">Full 30-year wealth comparison model with break-even and sensitivity analysis.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() =>
              exportDomToPdf({ elementId: 'rent-vs-buy-content', filenamePrefix: 'finwise-rent-vs-buy' })
            }
          >
            Export PDF
          </Button>
          <ExportButton
            onExportXlsx={async () => {
              const { exportRentVsBuyWorkbook } = await import('@/lib/excel/exports/rentVsBuy');
              exportRentVsBuyWorkbook(inputs, results);
            }}
            onExportCsv={() => downloadCsv(csvRows, 'finwise-rent-vs-buy')}
          />
        </div>
      </div>

      <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
        <div className="flex items-center justify-between gap-2">
          <span>✓ Pre-filled from your FinWise profile — adjust as needed</span>
          <button
            className="rounded border border-green-300 bg-white px-2 py-0.5 text-xs text-green-800 hover:bg-green-100"
            onClick={() =>
              setRentVsBuyInputs(
                buildProfileDefaults({
                  paycheckState: paycheckInputs?.state,
                  paycheckFiling: paycheckInputs?.filingStatus,
                  paycheckMarginal: paycheckResults?.marginalCombinedRate,
                  budgetHousing: budgetInputs?.housing,
                  homeTarget: plan?.inputs?.homeTarget,
                }),
              )
            }
          >
            Sync from profile
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[480px_1fr]">
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <h2 className="font-semibold">Home purchase</h2>
            <Field label="Purchase price" value={inputs.purchasePrice} suffix="$" step={10000} min={100000} max={2000000} onValue={(n) => setRentVsBuyInputs({ purchasePrice: n })} range />
            <Field label="Down payment (%)" value={inputs.downPaymentPct * 100} step={1} min={5} max={30} suffix="%" onValue={(n) => setRentVsBuyInputs({ downPaymentPct: n / 100 })} range helper={`= ${formatCurrency(inputs.purchasePrice * inputs.downPaymentPct)}`} />
            <Field label="Mortgage rate" value={inputs.mortgageRate * 100} step={0.05} min={0} max={12} suffix="%" onValue={(n) => setRentVsBuyInputs({ mortgageRate: n / 100 })} />
            <div className="flex items-center justify-between">
              <span className="text-sm">Loan term</span>
              <div className="flex gap-2">
                {[30, 15].map((term) => (
                  <button key={term} onClick={() => setRentVsBuyInputs({ loanTermYears: term })} className={`rounded-md border px-3 py-1 text-xs ${inputs.loanTermYears === term ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]' : ''}`}>{term}yr</button>
                ))}
              </div>
            </div>
            <Field label="Property tax rate" value={inputs.annualPropertyTaxRate * 100} step={0.01} min={0} max={4} suffix="%" onValue={(n) => setRentVsBuyInputs({ annualPropertyTaxRate: n / 100 })} />
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm text-muted-foreground">State</label>
              <div className="flex items-center gap-2">
                <input
                  className="w-36 rounded-md border px-2 py-1 text-sm"
                  value={inputs.state}
                  onChange={(e) => setRentVsBuyInputs({ state: e.target.value })}
                />
                <button
                  className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                  onClick={() => setRentVsBuyInputs({ annualPropertyTaxRate: getPropertyTaxRate(inputs.state) })}
                >
                  Use default tax
                </button>
              </div>
            </div>
            <Field label="Annual appreciation" value={inputs.annualAppreciationRate * 100} step={0.1} min={-5} max={10} suffix="%" onValue={(n) => setRentVsBuyInputs({ annualAppreciationRate: n / 100 })} />
            <Field label="Annual maintenance" value={inputs.annualMaintenancePct * 100} step={0.1} min={0} max={3} suffix="%" onValue={(n) => setRentVsBuyInputs({ annualMaintenancePct: n / 100 })} />
            <Field label="HOA monthly" value={inputs.hoaMonthly} suffix="$" step={25} min={0} max={2000} onValue={(n) => setRentVsBuyInputs({ hoaMonthly: n })} />
            <Field label="PMI rate" value={inputs.pmiRate * 100} step={0.05} min={0} max={3} suffix="%" onValue={(n) => setRentVsBuyInputs({ pmiRate: n / 100 })} />
            <Field label="Closing costs" value={inputs.closingCostPct * 100} step={0.1} min={0} max={8} suffix="%" onValue={(n) => setRentVsBuyInputs({ closingCostPct: n / 100 })} />
            <Field label="Selling costs" value={inputs.sellingCostPct * 100} step={0.1} min={0} max={10} suffix="%" onValue={(n) => setRentVsBuyInputs({ sellingCostPct: n / 100 })} />
          </div>

          <div className="rounded-xl border bg-card p-4 space-y-3">
            <h2 className="font-semibold">Renting</h2>
            <Field label="Monthly rent" value={inputs.monthlyRent} suffix="$" step={50} min={500} max={10000} onValue={(n) => setRentVsBuyInputs({ monthlyRent: n })} range />
            <Field label="Renters insurance" value={inputs.rentersInsuranceMonthly} suffix="$" step={1} min={0} max={100} onValue={(n) => setRentVsBuyInputs({ rentersInsuranceMonthly: n })} />
            <Field label="Annual rent increase" value={inputs.annualRentIncrease * 100} suffix="%" step={0.1} min={0} max={10} onValue={(n) => setRentVsBuyInputs({ annualRentIncrease: n / 100 })} />
          </div>

          <div className="rounded-xl border bg-card p-4 space-y-3">
            <h2 className="font-semibold">Your finances</h2>
            <Field label="Investment return" value={inputs.investmentReturnRate * 100} suffix="%" step={0.1} min={3} max={12} onValue={(n) => setRentVsBuyInputs({ investmentReturnRate: n / 100 })} range />
            <Field label="Marginal tax rate" value={inputs.marginalTaxRate * 100} suffix="%" step={0.1} min={0} max={50} onValue={(n) => setRentVsBuyInputs({ marginalTaxRate: n / 100 })} />
            <div className="flex items-center justify-between">
              <span className="text-sm">Itemize deductions</span>
              <div className="flex gap-2">
                {[
                  { label: 'Yes', val: true },
                  { label: 'No', val: false },
                ].map((o) => (
                  <button key={o.label} onClick={() => setRentVsBuyInputs({ itemizeDeductions: o.val })} className={`rounded-md border px-3 py-1 text-xs ${inputs.itemizeDeductions === o.val ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]' : ''}`}>{o.label}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Filing status</span>
              <select
                className="rounded-md border px-2 py-1 text-sm"
                value={inputs.filingStatus}
                onChange={(e) => setRentVsBuyInputs({ filingStatus: e.target.value })}
              >
                <option value="single">single</option>
                <option value="married">married</option>
                <option value="hoh">hoh</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 space-y-3">
            <h2 className="font-semibold">Your situation</h2>
            <Field label="Planned stay (years)" value={inputs.plannedStayYears} step={1} min={1} max={30} onValue={(n) => setRentVsBuyInputs({ plannedStayYears: n })} range helper={`${inputs.plannedStayYears} years`} />
          </div>
        </div>

        <div className="space-y-4">
          <div className={`rounded-xl p-5 ${SENTIMENT_STYLES[results.verdictSentiment]}`}>
            <h2 className="text-2xl font-bold">{results.verdictHeadline}</h2>
            <p className="mt-1 text-sm opacity-95">{results.verdictDetail}</p>
            <p className="mt-4 text-sm font-medium">
              Break-even: {results.breakEvenYear ? `${results.breakEvenYear.toFixed(1)} years` : 'Never breaks even'}
            </p>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <Metric title="True monthly cost (buying)" value={`${formatCurrency(results.trueMonthlyCostBuying)}/mo`} />
            <Metric title="Monthly rent" value={`${formatCurrency(results.trueMonthlyCostRenting)}/mo`} />
            <Metric title="Monthly difference" value={`${formatCurrency(Math.abs(results.monthlyDifference))} ${results.monthlyDifference >= 0 ? 'more to buy' : 'more to rent'}`} />
            <Metric title="Break-even" value={results.breakEvenYear ? `${results.breakEvenYear.toFixed(1)} years` : 'Never'} />
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-semibold mb-2">Wealth comparison (30 years)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={yTick} width={72} />
                <Tooltip
                  formatter={(v) => formatCurrency(typeof v === 'number' ? v : Number(v ?? 0))}
                  labelFormatter={(v) => `Year ${String(v)}`}
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length < 2) return null;
                    const buyer = Number(payload[0].value ?? 0);
                    const renter = Number(payload[1].value ?? 0);
                    const diff = buyer - renter;
                    return (
                      <div className="rounded-md border bg-white p-2 text-xs shadow">
                        <p className="font-semibold mb-1">Year {label}</p>
                        <p>Buyer net worth: {formatCurrency(buyer)}</p>
                        <p>Renter net worth: {formatCurrency(renter)}</p>
                        <p className="font-medium">Difference: {formatCurrency(diff)}</p>
                      </div>
                    );
                  }}
                />
                <Line type="monotone" dataKey="buyer" stroke="#1e3a5f" strokeWidth={2.5} name="Buyer net worth" dot={false} />
                <Line type="monotone" dataKey="renter" stroke="#0f766e" strokeWidth={2.5} name="Renter net worth" dot={false} />
                {results.breakEvenYear && <ReferenceLine x={results.breakEvenYear} stroke="#f59e0b" strokeDasharray="4 4" label="Break-even" />}
                <ReferenceLine x={inputs.plannedStayYears} stroke="#2563eb" strokeDasharray="4 4" label="Your timeline" />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-sm text-muted-foreground mt-2">
              At your planned {inputs.plannedStayYears}-year stay: {pickWinnerLabel(plannedDiff)}
            </p>
          </div>

          <div className="grid xl:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-card p-4 text-sm space-y-1">
              <h3 className="font-semibold mb-2">Monthly cost breakdown</h3>
              <Row label="Principal & interest" value={results.monthlyMortgagePI} />
              <Row label="Property tax" value={results.monthlyPropertyTax} />
              <Row label="Home insurance" value={results.monthlyInsurance} />
              <Row label="Maintenance" value={results.monthlyMaintenance} />
              <Row label="PMI" value={results.monthlyPMI} />
              <Row label="HOA" value={results.monthlyHOA} />
              <Row label="- Tax deduction" value={-results.monthlyMortgageInterestDeduction} />
              <hr />
              <Row label="True monthly cost (buying)" value={results.trueMonthlyCostBuying} bold />
              <Row label="True monthly cost (renting)" value={results.trueMonthlyCostRenting} bold />
              <p className="text-xs text-muted-foreground">Delta: Buying costs {formatCurrency(Math.abs(results.monthlyDifference))} {results.monthlyDifference >= 0 ? 'more' : 'less'} per month</p>
            </div>
            <div className="space-y-4">
              <div className="rounded-xl border bg-card p-4 text-sm space-y-1">
                <h3 className="font-semibold mb-2">Upfront costs</h3>
                <Row label={`Down payment (${(inputs.downPaymentPct * 100).toFixed(1)}%)`} value={results.downPayment} />
                <Row label={`Closing costs (${(inputs.closingCostPct * 100).toFixed(1)}%)`} value={results.closingCosts} />
                <hr />
                <Row label="Total cash needed" value={results.totalUpfront} bold />
                <p className="text-xs text-muted-foreground">This is the money leaving your portfolio on day one.</p>
              </div>
              <div className="rounded-xl border bg-card p-4 text-sm space-y-1">
                <h3 className="font-semibold mb-2">Opportunity cost</h3>
                <p className="text-xs text-muted-foreground mb-2">What if you invested {formatCurrency(results.totalUpfront)} instead?</p>
                <Row label="In 10 years" value={results.downPaymentIn10Years} />
                <Row label="In 20 years" value={results.downPaymentIn20Years} />
                <Row label="In 30 years" value={results.downPaymentIn30Years} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 space-y-3">
            <h3 className="font-semibold">Price-to-rent ratio</h3>
            <p className="text-sm">Your ratio: <span className="font-semibold">{results.priceToRentRatio.toFixed(1)}</span></p>
            <div className="h-3 rounded-full bg-gradient-to-r from-green-500 via-amber-400 to-red-600 relative">
              <span className="absolute top-[-4px] h-5 w-1 bg-black" style={{ left: `${Math.min(100, (results.priceToRentRatio / 40) * 100)}%` }} />
            </div>
            <div className="grid grid-cols-5 text-[11px] text-muted-foreground">
              <span>&lt;15 buy</span>
              <span>15-20 lean buy</span>
              <span>20-25 neutral</span>
              <span>25-30 lean rent</span>
              <span>&gt;30 rent</span>
            </div>
            <p className="text-sm text-muted-foreground">{results.priceToRentInterpretation}</p>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-semibold mb-2">Scenarios table</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2">Stay</th>
                    <th className="py-2 text-right">Buyer NW</th>
                    <th className="py-2 text-right">Renter NW</th>
                    <th className="py-2 text-right">Winner</th>
                    <th className="py-2 text-right">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {results.scenarios.map((s) => (
                    <tr key={s.stayYears} className={`${s.stayYears === inputs.plannedStayYears ? 'bg-[#1e3a5f] text-white' : 'border-b'}`}>
                      <td className="py-2">{s.stayYears} yrs</td>
                      <td className="py-2 text-right tabular-nums">{formatCurrency(s.buyerNetWorth)}</td>
                      <td className="py-2 text-right tabular-nums">{formatCurrency(s.renterNetWorth)}</td>
                      <td className="py-2 text-right">
                        {s.winner === 'buy' ? 'Buying ✓' : s.winner === 'rent' ? 'Renting ✓' : 'Too close'}
                      </td>
                      <td className="py-2 text-right tabular-nums">{formatCurrency(s.difference)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-semibold mb-2">Break-even year by home appreciation vs. investment return</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="p-2 text-left">Inv \ App</th>
                    {[1, 2, 3, 4, 5, 6].map((c) => <th key={c} className="p-2 text-center">{c}%</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[5, 6, 7, 8, 9].map((ir, rIdx) => (
                    <tr key={ir}>
                      <td className="p-2 font-medium">{ir}%</td>
                      {results.sensitivityMatrix[rIdx].map((cell, cIdx) => (
                        <td key={cIdx} className={`p-2 text-center border ${sensColor(cell.breakEvenYears)} ${Math.abs(cell.investmentReturn - inputs.investmentReturnRate) < 0.001 && Math.abs(cell.appreciationRate - inputs.annualAppreciationRate) < 0.001 ? 'border-2 border-[#1e3a5f] font-semibold' : 'border-gray-200'}`}>
                          {cell.breakEvenYears ? cell.breakEvenYears.toFixed(1) : 'Never'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Your current assumptions highlighted. Darker green means buying wins sooner.</p>
          </div>

          <div className="rounded-xl border bg-card p-4 grid md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">Reasons to buy</h3>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>✓ Stability and permanence</li>
                <li>✓ Can renovate freely</li>
                <li>✓ Forced savings via equity</li>
                <li>✓ Inflation hedge on costs</li>
                <li>✓ No landlord risk</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Reasons to rent</h3>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>✓ Geographic flexibility</li>
                <li>✓ No maintenance burden</li>
                <li>✓ Lower cash commitment</li>
                <li>✓ Easier to downsize or upsize</li>
                <li>✓ More liquid portfolio</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <Link href="/budget" className="text-blue-600 hover:underline">Wondering if you can afford to buy? →</Link>
            <Link href="/invest" className="text-blue-600 hover:underline">What if you invested your down payment? →</Link>
            <Link href="/plan" className="text-blue-600 hover:underline">See this in your plan →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onValue,
  suffix = '',
  step = 1,
  min = 0,
  max = 1000000,
  range = false,
  helper,
}: {
  label: string;
  value: number;
  onValue: (n: number) => void;
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
  range?: boolean;
  helper?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm text-muted-foreground">{label}</label>
        <div className="flex items-center gap-1">
          {suffix === '$' && <span className="text-sm">$</span>}
          <input
            type="number"
            className="w-24 rounded-md border px-2 py-1 text-right text-sm"
            value={Number(value.toFixed(4))}
            step={step}
            min={min}
            max={max}
            onChange={(e) => onValue(Number(e.target.value) || 0)}
          />
          {suffix && suffix !== '$' && <span className="text-sm">{suffix}</span>}
        </div>
      </div>
      {range && (
        <input type="range" className="w-full accent-[#2563eb]" value={value} min={min} max={max} step={step} onChange={(e) => onValue(Number(e.target.value))} />
      )}
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="text-lg font-bold mt-1">{value}</p>
    </div>
  );
}

function Row({ label, value, bold = false }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`${bold ? 'font-semibold' : 'text-muted-foreground'}`}>{label}</span>
      <span className={`tabular-nums ${bold ? 'font-semibold' : ''}`}>{formatCurrency(value)}</span>
    </div>
  );
}

function sensColor(v: number | null) {
  if (v === null) return 'bg-red-900 text-white';
  if (v < 5) return 'bg-green-700 text-white';
  if (v < 8) return 'bg-green-300';
  if (v < 12) return 'bg-yellow-200';
  if (v < 20) return 'bg-orange-200';
  return 'bg-red-200';
}
