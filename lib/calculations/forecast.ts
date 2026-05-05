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
