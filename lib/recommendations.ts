import { addMonths, format } from 'date-fns';
import type { StoreBudgetInputs, StorePaycheckInputs, StorePaycheckResults } from '@/lib/calculations';
import { computePaycheck, computeTotalExpenses } from '@/lib/calculations';
import type { Debt } from '@/lib/calculations/debt';
import { simulateDebtPayoff } from '@/lib/calculations/debt';
import type { BonusAllocations, BonusProfile } from '@/lib/bonusProfile';
import { monthName, normalizeBonusAllocations } from '@/lib/bonusProfile';
import type { ScoreBreakdown } from '@/lib/healthScore';
import { computeHealthScore } from '@/lib/healthScore';

export interface Recommendation {
  id: string;
  category: 'cashflow' | 'debt' | 'emergency' | 'savings' | 'tax' | 'bonus';
  priority: number;
  title: string;
  description: string;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  scoreImpact: {
    cashflow?: number;
    debt?: number;
    emergency?: number;
    savings?: number;
    tax?: number;
    overall: number;
  };
  simulatedChanges: {
    paycheckInputs?: Partial<StorePaycheckInputs>;
    budgetInputs?: Partial<StoreBudgetInputs>;
    debtExtraPayment?: number;
    modeledTotalDebt?: number;
  };
  metrics: Array<{
    label: string;
    before: string;
    after: string;
    delta: string;
    positive: boolean;
  }>;
  ctaLabel: string;
  ctaHref: string;
  tradeoff?: string;
}

const effortRank = { low: 0, medium: 1, high: 2 } as const;
const categoryRank = { tax: 0, debt: 1, emergency: 2, savings: 3, cashflow: 4, bonus: 5 } as const;

function sortRecs(a: Recommendation, b: Recommendation): number {
  if (Math.abs(b.scoreImpact.overall - a.scoreImpact.overall) > 1e-6) {
    return b.scoreImpact.overall - a.scoreImpact.overall;
  }
  if (effortRank[a.effort] !== effortRank[b.effort]) {
    return effortRank[a.effort] - effortRank[b.effort];
  }
  return categoryRank[a.category] - categoryRank[b.category];
}

export function generateRecommendations(
  score: ScoreBreakdown,
  paycheckResults: StorePaycheckResults,
  paycheckInputs: StorePaycheckInputs,
  budgetInputs: StoreBudgetInputs,
  debts: Debt[],
  bonusProfile: BonusProfile,
  debtStrategy: 'avalanche' | 'snowball' = 'avalanche',
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const monthlyIncome = paycheckResults.netPayMonthly + (budgetInputs.investmentIncome ?? 0);
  const monthlyExpenses = computeTotalExpenses(budgetInputs);
  const monthlySurplus = monthlyIncome - monthlyExpenses;
  const marginalRate = paycheckResults.marginalCombinedRate ?? 0.28;
  const ficaRate = 0.0765;

  const hsaLimit = 4300;
  const k401Limit = 23500;
  const hsaContrib = paycheckInputs.hsaAnnual ?? 0;
  const k401Annual = paycheckResults.k401TraditionalAnnual ?? 0;
  const k401Pct = paycheckInputs.k401TraditionalPct ?? 0;

  // ── HSA ──
  const hsaGap = hsaLimit - hsaContrib;
  if (hsaGap > 0 && paycheckResults.isComplete) {
    const monthlyHSAIncrease = hsaGap / 12;
    const hsaTaxSavings = hsaGap * (marginalRate + ficaRate);
    const netMonthlyImpact =
      -(monthlyHSAIncrease - monthlyHSAIncrease * (marginalRate + ficaRate));
    const simInputs: StorePaycheckInputs = { ...paycheckInputs, hsaAnnual: hsaLimit };
    const simResults = computePaycheck(simInputs);
    const newScore = computeHealthScore(
      simResults,
      simInputs,
      budgetInputs,
      debts,
      bonusProfile,
    );
    const taxGain = newScore.taxEfficiency.score - score.taxEfficiency.score;
    const overallGain = (newScore.overall - score.overall);
    recommendations.push({
      id: 'max-hsa',
      category: 'tax',
      priority: 1,
      title: 'Max your HSA',
      description: `You're contributing $${hsaContrib.toLocaleString()}/yr toward your HSA but the limit is $${hsaLimit.toLocaleString()}. Increasing saves about $${Math.round(hsaTaxSavings).toLocaleString()}/yr in taxes (federal + state + FICA on HSA).`,
      effort: 'low',
      impact: 'high',
      scoreImpact: {
        tax: taxGain,
        overall: overallGain,
      },
      simulatedChanges: { paycheckInputs: { hsaAnnual: hsaLimit } },
      metrics: [
        {
          label: 'Annual tax savings (est.)',
          before: `$${Math.round(hsaContrib * (marginalRate + ficaRate)).toLocaleString()}`,
          after: `$${Math.round(hsaLimit * (marginalRate + ficaRate)).toLocaleString()}`,
          delta: `+$${Math.round(hsaTaxSavings).toLocaleString()}/yr`,
          positive: true,
        },
        {
          label: 'Monthly take-home (est.)',
          before: `$${Math.round(monthlyIncome).toLocaleString()}`,
          after: `$${Math.round(monthlyIncome + netMonthlyImpact).toLocaleString()}`,
          delta: `${netMonthlyImpact >= 0 ? '+' : ''}$${Math.round(netMonthlyImpact)}/mo`,
          positive: netMonthlyImpact >= 0,
        },
        {
          label: 'Tax efficiency score',
          before: `${score.taxEfficiency.score}/100`,
          after: `${newScore.taxEfficiency.score}/100`,
          delta: `+${taxGain} pts`,
          positive: true,
        },
      ],
      ctaLabel: 'Update paycheck →',
      ctaHref: '/paycheck',
      tradeoff:
        monthlySurplus + netMonthlyImpact < 200
          ? `This reduces your modeled surplus to about $${Math.round(monthlySurplus + netMonthlyImpact)}/mo — confirm your budget can absorb it.`
          : undefined,
    });
  }

  // ── 401(k) +1% ──
  if (k401Annual < k401Limit && paycheckResults.grossAnnual > 0 && paycheckResults.isComplete) {
    const increaseBy1Pct = paycheckResults.grossAnnual * 0.01;
    const taxSavingsPer1Pct = increaseBy1Pct * marginalRate;
    const takehomeImpactPer1Pct = -(increaseBy1Pct * (1 - marginalRate)) / 12;
    const nextPct = Math.min(30, k401Pct + 1);
    const simInputs: StorePaycheckInputs = {
      ...paycheckInputs,
      k401TraditionalPct: nextPct,
    };
    const simResults = computePaycheck(simInputs);
    const newScore = computeHealthScore(
      simResults,
      simInputs,
      budgetInputs,
      debts,
      bonusProfile,
    );
    const taxGain = newScore.taxEfficiency.score - score.taxEfficiency.score;
    const savingsGain = newScore.savingsRate.score - score.savingsRate.score;
    const overallGain = newScore.overall - score.overall;
    const fvExtra =
      increaseBy1Pct * ((Math.pow(1.07, 30) - 1) / 0.07);

    recommendations.push({
      id: 'increase-401k',
      category: 'tax',
      priority: 2,
      title: `Increase traditional 401(k) to ${nextPct}%`,
      description: `Each 1% of salary into traditional 401(k) saves roughly $${Math.round(taxSavingsPer1Pct).toLocaleString()}/yr in taxes. Marginal rate ~${(marginalRate * 100).toFixed(0)}%.`,
      effort: 'low',
      impact: 'medium',
      scoreImpact: {
        tax: taxGain,
        savings: savingsGain,
        overall: overallGain,
      },
      simulatedChanges: { paycheckInputs: { k401TraditionalPct: nextPct } },
      metrics: [
        {
          label: 'Annual tax savings (est.)',
          before: `$${Math.round(k401Annual * marginalRate).toLocaleString()}`,
          after: `$${Math.round((k401Annual + increaseBy1Pct) * marginalRate).toLocaleString()}`,
          delta: `+$${Math.round(taxSavingsPer1Pct).toLocaleString()}/yr`,
          positive: true,
        },
        {
          label: 'Monthly take-home (est.)',
          before: `$${Math.round(monthlyIncome).toLocaleString()}`,
          after: `$${Math.round(monthlyIncome + takehomeImpactPer1Pct).toLocaleString()}`,
          delta: `$${Math.round(takehomeImpactPer1Pct)}/mo`,
          positive: false,
        },
        {
          label: 'Retirement contributions (annual)',
          before: `$${Math.round(k401Annual).toLocaleString()}`,
          after: `$${Math.round(k401Annual + increaseBy1Pct).toLocaleString()}`,
          delta: `+$${Math.round(increaseBy1Pct).toLocaleString()}/yr`,
          positive: true,
        },
        {
          label: '30-year value of +1% (7% return)',
          before: '—',
          after: `$${Math.round(fvExtra).toLocaleString()}`,
          delta: 'illustrative',
          positive: true,
        },
      ],
      ctaLabel: 'Update paycheck →',
      ctaHref: '/paycheck',
    });
  }

  // ── Debt acceleration ──
  if (debts.length > 0 && monthlySurplus > 0) {
    const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
    if (totalDebt > 0) {
      const extraPayment = Math.min(500, monthlySurplus * 0.5);
      const bonusMonth = bonusProfile.bonusMonth;
      const baseline = simulateDebtPayoff(debts, 0, 0, bonusMonth, debtStrategy);
      const accelerated = simulateDebtPayoff(
        debts,
        extraPayment,
        0,
        bonusMonth,
        debtStrategy,
      );
      const monthsSaved = Math.max(0, baseline.monthsToPayoff - accelerated.monthsToPayoff);
      const interestSaved = Math.max(
        0,
        baseline.totalInterestPaid - accelerated.totalInterestPaid,
      );
      const reducedDebt = Math.max(0, totalDebt - extraPayment * 12);
      const annualInc = monthlyIncome * 12;
      const newDTI = annualInc > 0 ? reducedDebt / annualInc : 0;
      const newDebtScore =
        reducedDebt === 0 ? 100 :
        newDTI < 0.1 ? 75 :
        newDTI < 0.2 ? 50 :
        newDTI < 0.35 ? 25 : 0;
      const debtScoreGain = newDebtScore - score.debt.score;
      const simScore = computeHealthScore(
        paycheckResults,
        paycheckInputs,
        budgetInputs,
        debts,
        bonusProfile,
        {
          monthlyDebtExtra: extraPayment,
          modeledTotalDebt: reducedDebt,
        },
      );
      const overallGain = simScore.overall - score.overall;
      const payoffDate = addMonths(new Date(), accelerated.monthsToPayoff);

      recommendations.push({
        id: 'accelerate-debt',
        category: 'debt',
        priority: 3,
        title: `Pay $${Math.round(extraPayment).toLocaleString()}/mo extra toward debt`,
        description: `Deploy about half your surplus ($${Math.round(monthlySurplus).toLocaleString()}/mo available) to knock down balances faster — about ${monthsSaved} fewer months to debt-free vs minimums-only in this model.`,
        effort: 'low',
        impact: 'high',
        scoreImpact: {
          debt: debtScoreGain,
          overall: overallGain,
        },
        simulatedChanges: {
          debtExtraPayment: extraPayment,
          modeledTotalDebt: reducedDebt,
        },
        metrics: [
          {
            label: 'Debt-free timing (model)',
            before: format(addMonths(new Date(), baseline.monthsToPayoff), 'MMM yyyy'),
            after: format(payoffDate, 'MMM yyyy'),
            delta: monthsSaved > 0 ? `${monthsSaved} mo sooner` : '—',
            positive: monthsSaved > 0,
          },
          {
            label: 'Interest paid (model)',
            before: `$${Math.round(baseline.totalInterestPaid).toLocaleString()}`,
            after: `$${Math.round(accelerated.totalInterestPaid).toLocaleString()}`,
            delta: interestSaved > 0 ? `−$${Math.round(interestSaved).toLocaleString()}` : '—',
            positive: true,
          },
          {
            label: 'Surplus after extra payment',
            before: `$${Math.round(monthlySurplus).toLocaleString()}`,
            after: `$${Math.round(monthlySurplus - extraPayment).toLocaleString()}`,
            delta: `−$${Math.round(extraPayment)}/mo`,
            positive: false,
          },
        ],
        ctaLabel: 'Open debt simulator →',
        ctaHref: '/debt',
        tradeoff: `Uses about $${Math.round(extraPayment).toLocaleString()}/mo of surplus until balances drop.`,
      });
    }
  }

  // ── Emergency fund ──
  const currentBalance = budgetInputs.emergencyFundBalance ?? 0;
  const target3 = monthlyExpenses * 3;
  if (currentBalance < target3 && monthlySurplus > 0 && monthlyExpenses > 0) {
    const suggestedContrib = Math.min(
      Math.round(monthlySurplus * 0.3),
      Math.max(100, Math.round((target3 - currentBalance) / 12)),
    );
    const gap = target3 - currentBalance;
    const monthsToTarget =
      suggestedContrib > 0 ? Math.ceil(gap / suggestedContrib) : null;
    const targetDate = monthsToTarget ? addMonths(new Date(), monthsToTarget) : null;
    const newBal = currentBalance + suggestedContrib * 12;
    const newMonthsCovered = newBal / monthlyExpenses;
    const newEmergencyScore =
      newMonthsCovered >= 6 ? 100 :
      newMonthsCovered >= 3 ? 75 :
      newMonthsCovered >= 1 ? 50 :
      newMonthsCovered > 0 ? 25 : 0;
    const emergencyScoreGain = newEmergencyScore - score.emergencyFund.score;
    const simBudget: StoreBudgetInputs = {
      ...budgetInputs,
      emergencyFundMonthly: suggestedContrib,
    };
    const simScore = computeHealthScore(
      paycheckResults,
      paycheckInputs,
      simBudget,
      debts,
      bonusProfile,
    );
    const overallGain = simScore.overall - score.overall;

    recommendations.push({
      id: 'build-emergency-fund',
      category: 'emergency',
      priority: currentBalance === 0 ? 2 : 4,
      title: `Save $${suggestedContrib.toLocaleString()}/mo toward emergencies`,
      description: `You have about ${score.emergencyFund.monthsCovered.toFixed(1)} months of expenses saved. Moving $${suggestedContrib.toLocaleString()}/mo toward cash buffers improves resilience.`,
      effort: 'low',
      impact: currentBalance === 0 ? 'high' : 'medium',
      scoreImpact: {
        emergency: emergencyScoreGain,
        overall: overallGain,
      },
      simulatedChanges: {
        budgetInputs: { emergencyFundMonthly: suggestedContrib },
      },
      metrics: [
        {
          label: 'Months of expenses covered (1-yr proj.)',
          before: `${score.emergencyFund.monthsCovered.toFixed(1)} mo`,
          after: `${newMonthsCovered.toFixed(1)} mo`,
          delta: `+${(newMonthsCovered - score.emergencyFund.monthsCovered).toFixed(1)} mo`,
          positive: true,
        },
        {
          label: '3-month cash target',
          before: currentBalance >= target3 ? 'Met' : `$${Math.round(gap).toLocaleString()} away`,
          after:
            newBal >= target3 ? 'On track ✓' : `$${Math.round(Math.max(0, target3 - newBal)).toLocaleString()} away`,
          delta: targetDate ? `~${format(targetDate, 'MMM yyyy')}` : '—',
          positive: true,
        },
        {
          label: 'Emergency fund score',
          before: `${score.emergencyFund.score}/100`,
          after: `${newEmergencyScore}/100`,
          delta: `+${emergencyScoreGain} pts`,
          positive: true,
        },
      ],
      ctaLabel: 'Update budget →',
      ctaHref: '/budget',
      tradeoff: `Redirects ~$${suggestedContrib.toLocaleString()}/mo from surplus temporarily.`,
    });
  }

  // ── Savings rate ──
  if (score.savingsRate.currentRate < 0.2 && monthlyIncome > 0) {
    const targetRate = 0.2;
    const targetSavings = monthlyIncome * targetRate;
    const gap = targetSavings - score.savingsRate.totalMonthlySavings;
    const suggestedIncrease = Math.min(gap, monthlySurplus * 0.5);
    if (suggestedIncrease > 50) {
      const newSaveTotal = score.savingsRate.totalMonthlySavings + suggestedIncrease;
      const newSavingsRate = newSaveTotal / monthlyIncome;
      const newSavingsScore =
        newSavingsRate >= 0.2 ? 100 :
        newSavingsRate >= 0.15 ? 75 :
        newSavingsRate >= 0.1 ? 50 :
        newSavingsRate >= 0.05 ? 25 : 0;
      const savingsScoreGain = newSavingsScore - score.savingsRate.score;
      const simBudget: StoreBudgetInputs = {
        ...budgetInputs,
        brokerageMonthly: (budgetInputs.brokerageMonthly ?? 0) + suggestedIncrease,
      };
      const simScore = computeHealthScore(
        paycheckResults,
        paycheckInputs,
        simBudget,
        debts,
        bonusProfile,
      );
      const overallGain = simScore.overall - score.overall;
      const monthlyReturn = 0.07 / 12;
      const fv30 =
        suggestedIncrease *
        ((Math.pow(1 + monthlyReturn, 360) - 1) / monthlyReturn);

      recommendations.push({
        id: 'increase-savings',
        category: 'savings',
        priority: 5,
        title: `Invest $${Math.round(suggestedIncrease).toLocaleString()}/mo more`,
        description: `Your modeled savings rate is ${(score.savingsRate.currentRate * 100).toFixed(1)}%. Adding $${Math.round(suggestedIncrease).toLocaleString()}/mo to brokerage moves toward the 20% target.`,
        effort: 'low',
        impact: 'high',
        scoreImpact: {
          savings: savingsScoreGain,
          overall: overallGain,
        },
        simulatedChanges: {
          budgetInputs: {
            brokerageMonthly: (budgetInputs.brokerageMonthly ?? 0) + suggestedIncrease,
          },
        },
        metrics: [
          {
            label: 'Monthly savings',
            before: `$${Math.round(score.savingsRate.totalMonthlySavings).toLocaleString()}`,
            after: `$${Math.round(newSaveTotal).toLocaleString()}`,
            delta: `+$${Math.round(suggestedIncrease).toLocaleString()}/mo`,
            positive: true,
          },
          {
            label: 'Savings rate',
            before: `${(score.savingsRate.currentRate * 100).toFixed(1)}%`,
            after: `${(newSavingsRate * 100).toFixed(1)}%`,
            delta: `+${((newSavingsRate - score.savingsRate.currentRate) * 100).toFixed(1)} pts`,
            positive: true,
          },
          {
            label: 'Wealth built over 30y (7%)',
            before: '—',
            after: `$${Math.round(fv30).toLocaleString()}`,
            delta: 'illustrative',
            positive: true,
          },
        ],
        ctaLabel: 'Update budget →',
        ctaHref: '/budget',
      });
    }
  }

  // ── Bonus to debt ──
  if (
    bonusProfile.annualBonusAmount > 0 &&
    bonusProfile.allocations.debtPayoff === 0 &&
    debts.some((d) => d.balance > 0)
  ) {
    const bonusDebtAmount = bonusProfile.annualBonusAmount * 0.4;
    const bm = bonusProfile.bonusMonth;
    const baseline = simulateDebtPayoff(debts, 0, 0, bm, debtStrategy);
    const withBonus = simulateDebtPayoff(debts, 0, bonusDebtAmount, bm, debtStrategy);
    const monthsSaved = Math.max(0, baseline.monthsToPayoff - withBonus.monthsToPayoff);
    const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
    const reduced = Math.max(0, totalDebt - bonusDebtAmount);
    const newScoreBreakdown = computeHealthScore(
      paycheckResults,
      paycheckInputs,
      budgetInputs,
      debts,
      bonusProfile,
      { modeledTotalDebt: reduced },
    );
    const debtGain = newScoreBreakdown.debt.score - score.debt.score;
    const overallGain = newScoreBreakdown.overall - score.overall;

    recommendations.push({
      id: 'allocate-bonus-to-debt',
      category: 'bonus',
      priority: 2,
      title: 'Allocate 40% of bonus to debt payoff',
      description: `Your bonus plan sends $0 to debt today. Moving $${Math.round(bonusDebtAmount).toLocaleString()} (40% of your modeled bonus) to principal each ${monthName(bonusProfile.bonusMonth)} can shorten payoff materially.`,
      effort: 'low',
      impact: 'high',
      scoreImpact: {
        debt: debtGain,
        overall: overallGain,
      },
      simulatedChanges: {
        modeledTotalDebt: reduced,
      },
      metrics: [
        {
          label: 'Months to payoff (model)',
          before: `${baseline.monthsToPayoff} mo`,
          after: `${withBonus.monthsToPayoff} mo`,
          delta: monthsSaved > 0 ? `${monthsSaved} mo sooner` : '—',
          positive: monthsSaved > 0,
        },
        {
          label: 'Debt balance after bonus shock (illustrative)',
          before: `$${Math.round(totalDebt).toLocaleString()}`,
          after: `$${Math.round(reduced).toLocaleString()}`,
          delta: `−$${Math.round(bonusDebtAmount).toLocaleString()}`,
          positive: true,
        },
      ],
      ctaLabel: 'Configure bonus →',
      ctaHref: '/settings/bonus',
    });
  }

  recommendations.sort(sortRecs);
  return recommendations;
}

/** Apply 40% debt / scale other categories to fill remaining 60%. */
export function bonusAllocationWithDebtFocus(current: BonusAllocations): BonusAllocations {
  const keys = [
    'emergencyFund',
    'homeDownPayment',
    'brokerage',
    'rothIra',
    'cash',
  ] as const;
  const sumOther = keys.reduce((s, k) => s + current[k], 0);
  const rem = 60;
  if (sumOther <= 0) {
    return normalizeBonusAllocations({
      debtPayoff: 40,
      emergencyFund: 10,
      homeDownPayment: 10,
      brokerage: 20,
      rothIra: 0,
      cash: 20,
    });
  }
  const draft: BonusAllocations = {
    debtPayoff: 40,
    emergencyFund: 0,
    homeDownPayment: 0,
    brokerage: 0,
    rothIra: 0,
    cash: 0,
  };
  for (const k of keys) {
    draft[k] = Math.round((rem * current[k]) / sumOther);
  }
  return normalizeBonusAllocations(draft);
}
