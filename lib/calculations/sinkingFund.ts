import { addMonths, diffMonths, round2, toMonthlyRate, yearMonth } from '@/lib/calculations/shared';

export type SinkingFundGoalType = 'vacation' | 'down-payment' | 'custom';
export type SinkingFundMode = 'target-date' | 'monthly-contribution';

export interface SinkingFundInputs {
  goalType: SinkingFundGoalType;
  goalName: string;
  targetAmount: number;
  currentSavings: number;
  annualYieldPct: number;
  monthlyContribution: number;
  targetDate: string; // yyyy-mm
  mode: SinkingFundMode;
}

export interface SinkingFundPoint {
  month: number;
  date: string; // yyyy-mm
  contribution: number;
  interest: number;
  balance: number;
  progressPct: number;
}

export interface SinkingFundResults {
  requiredMonthlyContribution: number;
  projectedCompletionDate: string | null;
  monthsToGoal: number | null;
  totalContributions: number;
  totalInterest: number;
  finalBalance: number;
  schedule: SinkingFundPoint[];
}

function nowYm(): string {
  return yearMonth(new Date());
}

export const DEFAULT_SINKING_FUND_INPUTS: SinkingFundInputs = {
  goalType: 'vacation',
  goalName: 'Vacation',
  targetAmount: 6000,
  currentSavings: 500,
  annualYieldPct: 4,
  monthlyContribution: 300,
  targetDate: addMonths(nowYm(), 12),
  mode: 'target-date',
};

export function computeSinkingFund(inputs: SinkingFundInputs): SinkingFundResults {
  const startYm = nowYm();
  const monthlyRate = toMonthlyRate(Math.max(0, inputs.annualYieldPct) / 100);
  const target = Math.max(0, inputs.targetAmount);
  const current = Math.max(0, inputs.currentSavings);

  const horizonMonths = Math.max(1, diffMonths(startYm, inputs.targetDate));
  const requiredMonthlyContribution = (() => {
    if (target <= current) return 0;
    if (monthlyRate === 0) return (target - current) / horizonMonths;
    const growth = Math.pow(1 + monthlyRate, horizonMonths);
    return (target - current * growth) * (monthlyRate / (growth - 1));
  })();

  const contributionForSchedule =
    inputs.mode === 'target-date'
      ? Math.max(0, requiredMonthlyContribution)
      : Math.max(0, inputs.monthlyContribution);

  const maxMonths = 600;
  let balance = current;
  let cumulativeContributions = 0;
  let cumulativeInterest = 0;
  let completionMonth: number | null = target <= current ? 0 : null;
  const schedule: SinkingFundPoint[] = [];

  for (let m = 1; m <= maxMonths; m++) {
    const interest = balance * monthlyRate;
    balance += interest + contributionForSchedule;
    cumulativeContributions += contributionForSchedule;
    cumulativeInterest += interest;
    const progressPct = target > 0 ? Math.min((balance / target) * 100, 100) : 0;

    schedule.push({
      month: m,
      date: addMonths(startYm, m),
      contribution: round2(contributionForSchedule),
      interest: round2(interest),
      balance: round2(balance),
      progressPct: round2(progressPct),
    });

    if (completionMonth === null && balance >= target) {
      completionMonth = m;
      if (inputs.mode === 'monthly-contribution') break;
      if (m >= horizonMonths) break;
    }

    if (inputs.mode === 'target-date' && m >= horizonMonths) break;
  }

  const monthsToGoal = completionMonth;
  const projectedCompletionDate =
    completionMonth === null ? null : addMonths(startYm, completionMonth);

  return {
    requiredMonthlyContribution: round2(requiredMonthlyContribution),
    projectedCompletionDate,
    monthsToGoal,
    totalContributions: round2(cumulativeContributions),
    totalInterest: round2(cumulativeInterest),
    finalBalance: round2(balance),
    schedule,
  };
}
