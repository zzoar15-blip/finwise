export interface RentVsBuyInputs {
  purchasePrice: number;
  downPaymentPct: number;
  mortgageRate: number;
  loanTermYears: number;
  annualPropertyTaxRate: number;
  annualAppreciationRate: number;
  annualMaintenancePct: number;
  hoaMonthly: number;
  closingCostPct: number;
  sellingCostPct: number;
  pmiRate: number;
  monthlyRent: number;
  annualRentIncrease: number;
  rentersInsuranceMonthly: number;
  investmentReturnRate: number;
  marginalTaxRate: number;
  filingStatus: string;
  itemizeDeductions: boolean;
  plannedStayYears: number;
  state: string;
}

export interface MonthlySnapshot {
  month: number;
  homeValue: number;
  mortgageBalance: number;
  homeEquity: number;
  buyerLiquidPortfolio: number;
  buyerNetWorth: number;
  buyerMonthlyCost: number;
  buyerCumulativeCost: number;
  renterPortfolio: number;
  renterNetWorth: number;
  renterMonthlyCost: number;
  renterCumulativeCost: number;
  netWorthDifference: number;
}

export interface ScenarioResult {
  stayYears: number;
  buyerNetWorth: number;
  renterNetWorth: number;
  winner: 'buy' | 'rent' | 'tie';
  difference: number;
  verdict: string;
}

export interface SensitivityCell {
  appreciationRate: number;
  investmentReturn: number;
  breakEvenYears: number | null;
}

export interface RentVsBuyResults {
  breakEvenMonth: number | null;
  breakEvenYear: number | null;
  plannedStayResult: ScenarioResult;
  monthlyData: MonthlySnapshot[];
  downPayment: number;
  closingCosts: number;
  totalUpfront: number;
  monthlyMortgagePI: number;
  monthlyPropertyTax: number;
  monthlyInsurance: number;
  monthlyMaintenance: number;
  monthlyPMI: number;
  monthlyHOA: number;
  monthlyMortgageInterestDeduction: number;
  trueMonthlyCostBuying: number;
  trueMonthlyCostRenting: number;
  monthlyDifference: number;
  downPaymentIn10Years: number;
  downPaymentIn20Years: number;
  downPaymentIn30Years: number;
  priceToRentRatio: number;
  priceToRentInterpretation: string;
  scenarios: ScenarioResult[];
  sensitivityMatrix: SensitivityCell[][];
  verdictHeadline: string;
  verdictDetail: string;
  verdictSentiment: 'strong-buy' | 'lean-buy' | 'neutral' | 'lean-rent' | 'strong-rent';
}

const DEFAULT_INPUTS: RentVsBuyInputs = {
  purchasePrice: 600000,
  downPaymentPct: 0.2,
  mortgageRate: 0.065,
  loanTermYears: 30,
  annualPropertyTaxRate: 0.011,
  annualAppreciationRate: 0.035,
  annualMaintenancePct: 0.01,
  hoaMonthly: 0,
  closingCostPct: 0.03,
  sellingCostPct: 0.06,
  pmiRate: 0.008,
  monthlyRent: 3000,
  annualRentIncrease: 0.03,
  rentersInsuranceMonthly: 15,
  investmentReturnRate: 0.07,
  marginalTaxRate: 0.28,
  filingStatus: 'single',
  itemizeDeductions: false,
  plannedStayYears: 7,
  state: 'Massachusetts',
};

function clamp(num: number, min: number, max: number) {
  return Math.max(min, Math.min(max, num));
}

function normalizeInputs(inputs: RentVsBuyInputs): RentVsBuyInputs {
  return {
    ...DEFAULT_INPUTS,
    ...inputs,
    downPaymentPct: clamp(inputs.downPaymentPct ?? DEFAULT_INPUTS.downPaymentPct, 0, 0.99),
    mortgageRate: Math.max(0, inputs.mortgageRate ?? DEFAULT_INPUTS.mortgageRate),
    annualPropertyTaxRate: Math.max(0, inputs.annualPropertyTaxRate ?? DEFAULT_INPUTS.annualPropertyTaxRate),
    annualAppreciationRate: inputs.annualAppreciationRate ?? DEFAULT_INPUTS.annualAppreciationRate,
    annualMaintenancePct: Math.max(0, inputs.annualMaintenancePct ?? DEFAULT_INPUTS.annualMaintenancePct),
    closingCostPct: Math.max(0, inputs.closingCostPct ?? DEFAULT_INPUTS.closingCostPct),
    sellingCostPct: Math.max(0, inputs.sellingCostPct ?? DEFAULT_INPUTS.sellingCostPct),
    pmiRate: Math.max(0, inputs.pmiRate ?? DEFAULT_INPUTS.pmiRate),
    annualRentIncrease: inputs.annualRentIncrease ?? DEFAULT_INPUTS.annualRentIncrease,
    investmentReturnRate: inputs.investmentReturnRate ?? DEFAULT_INPUTS.investmentReturnRate,
    marginalTaxRate: clamp(inputs.marginalTaxRate ?? DEFAULT_INPUTS.marginalTaxRate, 0, 1),
    plannedStayYears: clamp(Math.round(inputs.plannedStayYears ?? DEFAULT_INPUTS.plannedStayYears), 1, 30),
  };
}

function pmt(principal: number, monthlyRate: number, months: number): number {
  if (months <= 0) return 0;
  if (monthlyRate === 0) return principal / months;
  const growth = Math.pow(1 + monthlyRate, months);
  return principal * (monthlyRate * growth) / (growth - 1);
}

function computeCore(inputs: RentVsBuyInputs) {
  const downPayment = inputs.purchasePrice * inputs.downPaymentPct;
  const loanAmount = Math.max(0, inputs.purchasePrice - downPayment);
  const closingCosts = inputs.purchasePrice * inputs.closingCostPct;
  const totalUpfront = downPayment + closingCosts;
  const monthlyMortgageRate = inputs.mortgageRate / 12;
  const n = Math.max(1, Math.round(inputs.loanTermYears * 12));
  const monthlyPI = pmt(loanAmount, monthlyMortgageRate, n);
  const monthlyReturn = inputs.investmentReturnRate / 12;
  const pmiThreshold = inputs.purchasePrice * 0.8;

  let mortgageBalance = loanAmount;
  let buyerLiquid = 0;
  let renterPortfolio = totalUpfront;
  let currentRent = inputs.monthlyRent;
  let currentHomeValue = inputs.purchasePrice;
  let breakEvenMonth: number | null = null;
  const monthlyData: MonthlySnapshot[] = [];

  for (let m = 1; m <= 360; m++) {
    if (m > 1 && (m - 1) % 12 === 0) {
      currentRent *= 1 + inputs.annualRentIncrease;
      currentHomeValue *= 1 + inputs.annualAppreciationRate;
    }

    const interestPayment = mortgageBalance * monthlyMortgageRate;
    const principalPayment = Math.max(0, monthlyPI - interestPayment);
    mortgageBalance = Math.max(0, mortgageBalance - principalPayment);

    const propertyTax = currentHomeValue * inputs.annualPropertyTaxRate / 12;
    const homeInsurance = currentHomeValue * 0.005 / 12;
    const maintenance = currentHomeValue * inputs.annualMaintenancePct / 12;
    const pmi = mortgageBalance > pmiThreshold ? loanAmount * inputs.pmiRate / 12 : 0;

    const monthlyInterestDeduction = inputs.itemizeDeductions
      ? interestPayment * inputs.marginalTaxRate
      : 0;

    const buyerMonthlyCost = monthlyPI + propertyTax + homeInsurance + maintenance + pmi + inputs.hoaMonthly - monthlyInterestDeduction;
    const renterMonthlyCost = currentRent + inputs.rentersInsuranceMonthly;
    const monthlyDelta = buyerMonthlyCost - renterMonthlyCost;

    buyerLiquid = buyerLiquid * (1 + monthlyReturn) - monthlyDelta;
    renterPortfolio = renterPortfolio * (1 + monthlyReturn) + Math.max(0, monthlyDelta);

    const sellingCosts = currentHomeValue * inputs.sellingCostPct;
    const homeEquity = currentHomeValue - mortgageBalance;
    const buyerNetWorth = homeEquity + Math.max(0, buyerLiquid) - sellingCosts;
    const renterNetWorth = renterPortfolio;

    if (!breakEvenMonth && m > 1) {
      const prev = monthlyData[m - 2];
      if (buyerNetWorth >= renterNetWorth && prev.buyerNetWorth < prev.renterNetWorth) {
        breakEvenMonth = m;
      }
    }

    monthlyData.push({
      month: m,
      homeValue: currentHomeValue,
      mortgageBalance,
      homeEquity,
      buyerLiquidPortfolio: buyerLiquid,
      buyerNetWorth,
      buyerMonthlyCost,
      buyerCumulativeCost: (monthlyData[m - 2]?.buyerCumulativeCost ?? totalUpfront) + buyerMonthlyCost,
      renterPortfolio,
      renterNetWorth,
      renterMonthlyCost,
      renterCumulativeCost: (monthlyData[m - 2]?.renterCumulativeCost ?? 0) + renterMonthlyCost,
      netWorthDifference: buyerNetWorth - renterNetWorth,
    });
  }

  return {
    downPayment,
    loanAmount,
    closingCosts,
    totalUpfront,
    monthlyMortgageRate,
    monthlyPI,
    breakEvenMonth,
    monthlyData,
  };
}

export function buildScenarioVerdict(winner: ScenarioResult['winner'], difference: number, years: number) {
  if (winner === 'tie') return `Too close to call at ${years} years`;
  const who = winner === 'buy' ? 'Buying wins' : 'Renting wins';
  return `${who} by $${Math.round(difference).toLocaleString()}`;
}

export function buildVerdict(
  breakEvenYear: number | null,
  _plannedStay: number,
  _winner: ScenarioResult['winner'],
  _difference: number,
  _ptr: number,
) {
  if (!breakEvenYear) {
    return {
      headline: 'Renting wins financially in your scenario',
      detail: 'At these assumptions, buying never overtakes renting over a 30-year horizon. The opportunity cost of your down payment and higher monthly costs make renting the stronger financial choice.',
      sentiment: 'strong-rent' as const,
    };
  }
  if (breakEvenYear <= 3) {
    return {
      headline: `Buying makes sense if you stay ${Math.ceil(breakEvenYear)}+ years`,
      detail: `Your break-even is relatively quick at ${breakEvenYear.toFixed(1)} years. If you plan to stay, buying builds wealth faster.`,
      sentiment: 'strong-buy' as const,
    };
  }
  if (breakEvenYear <= 5) {
    return {
      headline: `Buying works if you stay ${Math.ceil(breakEvenYear)}+ years`,
      detail: `Break-even at ${breakEvenYear.toFixed(1)} years. Buying is the better financial choice if you're confident about staying.`,
      sentiment: 'lean-buy' as const,
    };
  }
  if (breakEvenYear <= 8) {
    return {
      headline: `It's close — break-even at ${breakEvenYear.toFixed(1)} years`,
      detail: 'This is genuinely a close call. Lifestyle factors — stability, flexibility, control — matter as much as the math here.',
      sentiment: 'neutral' as const,
    };
  }
  if (breakEvenYear <= 12) {
    return {
      headline: `Renting has a financial edge for the next ${breakEvenYear.toFixed(0)} years`,
      detail: `Buying doesn't overtake renting until year ${breakEvenYear.toFixed(1)}. Renting and investing the difference builds more wealth over your planned stay.`,
      sentiment: 'lean-rent' as const,
    };
  }
  return {
    headline: 'Renting is the stronger financial choice in your scenario',
    detail: `With a break-even of ${breakEvenYear.toFixed(0)} years, renting and investing significantly outperforms buying over any reasonable timeframe. Buying here is a lifestyle choice, not a financial one.`,
    sentiment: 'strong-rent' as const,
  };
}

export function computeRentVsBuy(rawInputs: RentVsBuyInputs): RentVsBuyResults {
  const inputs = normalizeInputs(rawInputs);
  const core = computeCore(inputs);
  const { monthlyData } = core;

  const scenarioYears = [3, 5, 7, 10, 15, 20, 30];
  const scenarios: ScenarioResult[] = scenarioYears.map((years) => {
    const snap = monthlyData[years * 12 - 1];
    const diff = snap.buyerNetWorth - snap.renterNetWorth;
    const winner: ScenarioResult['winner'] = Math.abs(diff) < 5000 ? 'tie' : diff > 0 ? 'buy' : 'rent';
    return {
      stayYears: years,
      buyerNetWorth: snap.buyerNetWorth,
      renterNetWorth: snap.renterNetWorth,
      winner,
      difference: Math.abs(diff),
      verdict: buildScenarioVerdict(winner, Math.abs(diff), years),
    };
  });

  const appreciationRates = [0.01, 0.02, 0.03, 0.04, 0.05, 0.06];
  const investmentReturns = [0.05, 0.06, 0.07, 0.08, 0.09];
  const sensitivityMatrix: SensitivityCell[][] = investmentReturns.map((ir) =>
    appreciationRates.map((ar) => {
      const mini = computeCore({ ...inputs, annualAppreciationRate: ar, investmentReturnRate: ir });
      return {
        appreciationRate: ar,
        investmentReturn: ir,
        breakEvenYears: mini.breakEvenMonth ? mini.breakEvenMonth / 12 : null,
      };
    }),
  );

  const priceToRentRatio = inputs.purchasePrice / Math.max(1, inputs.monthlyRent * 12);
  const priceToRentInterpretation = priceToRentRatio < 15
    ? 'Strongly favors buying'
    : priceToRentRatio < 20
      ? 'Leans toward buying'
      : priceToRentRatio < 25
        ? 'Neutral — depends on your situation'
        : priceToRentRatio < 30
          ? 'Leans toward renting'
          : 'Strongly favors renting';

  const downPaymentIn10Years = core.totalUpfront * Math.pow(1 + inputs.investmentReturnRate, 10);
  const downPaymentIn20Years = core.totalUpfront * Math.pow(1 + inputs.investmentReturnRate, 20);
  const downPaymentIn30Years = core.totalUpfront * Math.pow(1 + inputs.investmentReturnRate, 30);

  const plannedIndex = Math.min(inputs.plannedStayYears * 12 - 1, 359);
  const plannedSnap = monthlyData[plannedIndex];
  const plannedDiff = plannedSnap.buyerNetWorth - plannedSnap.renterNetWorth;
  const plannedWinner: ScenarioResult['winner'] = Math.abs(plannedDiff) < 5000 ? 'tie' : plannedDiff > 0 ? 'buy' : 'rent';

  const breakEvenYear = core.breakEvenMonth ? core.breakEvenMonth / 12 : null;
  const verdict = buildVerdict(breakEvenYear, inputs.plannedStayYears, plannedWinner, plannedDiff, priceToRentRatio);

  return {
    breakEvenMonth: core.breakEvenMonth,
    breakEvenYear,
    plannedStayResult: {
      stayYears: inputs.plannedStayYears,
      buyerNetWorth: plannedSnap.buyerNetWorth,
      renterNetWorth: plannedSnap.renterNetWorth,
      winner: plannedWinner,
      difference: Math.abs(plannedDiff),
      verdict: buildScenarioVerdict(plannedWinner, Math.abs(plannedDiff), inputs.plannedStayYears),
    },
    monthlyData,
    downPayment: core.downPayment,
    closingCosts: core.closingCosts,
    totalUpfront: core.totalUpfront,
    monthlyMortgagePI: core.monthlyPI,
    monthlyPropertyTax: inputs.purchasePrice * inputs.annualPropertyTaxRate / 12,
    monthlyInsurance: inputs.purchasePrice * 0.005 / 12,
    monthlyMaintenance: inputs.purchasePrice * inputs.annualMaintenancePct / 12,
    monthlyPMI: inputs.downPaymentPct < 0.2 ? core.loanAmount * inputs.pmiRate / 12 : 0,
    monthlyHOA: inputs.hoaMonthly,
    monthlyMortgageInterestDeduction: inputs.itemizeDeductions
      ? (core.loanAmount * core.monthlyMortgageRate) * inputs.marginalTaxRate
      : 0,
    trueMonthlyCostBuying: monthlyData[0].buyerMonthlyCost,
    trueMonthlyCostRenting: monthlyData[0].renterMonthlyCost,
    monthlyDifference: monthlyData[0].buyerMonthlyCost - monthlyData[0].renterMonthlyCost,
    downPaymentIn10Years,
    downPaymentIn20Years,
    downPaymentIn30Years,
    priceToRentRatio,
    priceToRentInterpretation,
    scenarios,
    sensitivityMatrix,
    verdictHeadline: verdict.headline,
    verdictDetail: verdict.detail,
    verdictSentiment: verdict.sentiment,
  };
}
