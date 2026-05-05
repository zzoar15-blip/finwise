export interface Scenario {
  id: string;
  name: string;
  color: string;
  startingSalary: number;
  annualRaise: number; // %
  savingsRate: number; // %
  investmentReturn: number; // %
  startingNetWorth: number;
}

export interface YearPoint {
  year: number;
  salary: number;
  annualSavings: number;
  investmentGrowth: number;
  netWorth: number;
}

export interface ScenarioResult {
  scenario: Scenario;
  points: YearPoint[];
}

export interface Breakeven {
  scenarioA: string;
  scenarioB: string;
  year: number | null; // null if no crossover within 10 years
}

export interface ConfidenceBandPoint {
  year: number;
  p10: number;
  p50: number;
  p90: number;
}

export function forecastScenario(scenario: Scenario, years = 10): YearPoint[] {
  const points: YearPoint[] = [];
  let netWorth = scenario.startingNetWorth;
  let salary = scenario.startingSalary;

  for (let y = 1; y <= years; y++) {
    const investmentGrowth = netWorth * (scenario.investmentReturn / 100);
    const annualSavings = salary * (scenario.savingsRate / 100);
    netWorth = netWorth + investmentGrowth + annualSavings;
    points.push({ year: y, salary, annualSavings, investmentGrowth, netWorth });
    salary *= 1 + scenario.annualRaise / 100;
  }
  return points;
}

export function findBreakeven(a: YearPoint[], b: YearPoint[]): number | null {
  for (let i = 1; i < a.length; i++) {
    const prevDiff = a[i - 1].netWorth - b[i - 1].netWorth;
    const currDiff = a[i].netWorth - b[i].netWorth;
    if (prevDiff * currDiff < 0) return a[i].year; // sign flip = crossover
  }
  return null;
}

export function buildConfidenceBands(
  scenario: Scenario,
  years = 10,
): ConfidenceBandPoint[] {
  const pessimistic = forecastScenario(
    {
      ...scenario,
      annualRaise: Math.max(0, scenario.annualRaise - 1.5),
      savingsRate: Math.max(0, scenario.savingsRate - 4),
      investmentReturn: Math.max(1, scenario.investmentReturn - 3),
    },
    years,
  );
  const baseline = forecastScenario(scenario, years);
  const optimistic = forecastScenario(
    {
      ...scenario,
      annualRaise: scenario.annualRaise + 1.5,
      savingsRate: scenario.savingsRate + 4,
      investmentReturn: scenario.investmentReturn + 3,
    },
    years,
  );

  return baseline.map((point, idx) => ({
    year: point.year,
    p10: pessimistic[idx]?.netWorth ?? point.netWorth,
    p50: point.netWorth,
    p90: optimistic[idx]?.netWorth ?? point.netWorth,
  }));
}
