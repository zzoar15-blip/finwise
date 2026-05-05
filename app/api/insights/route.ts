import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import type { PlanInputs } from '@/types/plan';
import type { PlanMetrics } from '@/lib/planCalculations';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildContext(inputs: PlanInputs, metrics: PlanMetrics): string {
  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

  const lines = [
    `Name: ${inputs.name || 'Anonymous'}`,
    `Annual salary: ${fmt(inputs.annualSalary)}`,
    `State: ${inputs.state}`,
    `Filing status: ${inputs.filingStatus}`,
    `Monthly take-home: ${fmt(metrics.monthlyTakeHome)}`,
    `Monthly expenses: ${fmt(metrics.totalMonthlyExpenses)}`,
    `Monthly surplus: ${fmt(metrics.monthlySurplus)}`,
    `Savings rate: ${metrics.savingsRate.toFixed(1)}%`,
    `Tax efficiency score: ${metrics.taxEfficiencyScore}/100`,
    `Financial health score: ${metrics.financialHealthScore}/100`,
    `401(k) traditional: ${inputs.traditional401kPct}%`,
    `HSA per period: ${fmt(inputs.hsaPerPeriod)}`,
    `FSA per period: ${fmt(inputs.fsaPerPeriod)}`,
  ];

  if (metrics.hasDebts) {
    lines.push(`Total debt: ${fmt(metrics.totalDebtBalance)}`);
    lines.push(`Debt-free date: ${metrics.debtFreeDate ?? 'unknown'}`);
    lines.push(
      `Debts: ${inputs.debts
        .map((d) => `${d.name} (${fmt(d.balance)} @ ${d.apr}% APR)`)
        .join(', ')}`
    );
  } else {
    lines.push('No debt.');
  }

  if (inputs.goals.length > 0) {
    lines.push(`Goals: ${inputs.goals.join(', ')}`);
  }

  if (inputs.emergencyFundTarget > 0) {
    lines.push(`Emergency fund target: ${fmt(inputs.emergencyFundTarget)}`);
    lines.push(`Current emergency fund coverage: ${metrics.emergencyFundMonthsCovered.toFixed(1)} months`);
  }

  if (metrics.monthlyInvestCapacity > 0) {
    lines.push(`Monthly investment capacity: ${fmt(metrics.monthlyInvestCapacity)}`);
    const yr5 = metrics.investResult?.annual[4];
    if (yr5) {
      lines.push(`Projected 5-year portfolio: ${fmt(yr5.portfolioValue)}`);
      lines.push(`Projected monthly passive income (yr 5): ${fmt(yr5.afterTaxAnnualIncome / 12)}`);
    }
  }

  if (metrics.taxSuggestions.length > 0) {
    lines.push(
      `Tax optimization opportunities: ${metrics.taxSuggestions
        .map((s) => `${s.label} saves ${fmt(s.additionalSavings)}/yr`)
        .join('; ')}`
    );
  }

  if (metrics.goalWarnings.length > 0) {
    lines.push(
      `Goal warnings: ${metrics.goalWarnings
        .map((w) => `${w.title} (${w.level})`)
        .join('; ')}`
    );
  }

  return lines.join('\n');
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 });
  }

  const { inputs, metrics } = await req.json() as { inputs: PlanInputs; metrics: PlanMetrics };

  if (!inputs || !metrics) {
    return NextResponse.json({ error: 'Missing inputs or metrics' }, { status: 400 });
  }

  const context = buildContext(inputs, metrics);

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `You are a concise personal finance advisor generating insights for a user's financial plan.
Return ONLY a JSON array of 3-5 insight objects, each with:
- "type": one of "tip", "warning", or "success"
- "text": one crisp sentence (max 2 sentences) of actionable insight specific to this user's numbers

Be specific — reference their actual dollar amounts and dates. No generic advice. No preamble, no explanation, just the JSON array.

Example output:
[
  {"type":"tip","text":"Your HSA saves $847 more per year than a 401(k) contribution of the same amount because HSA avoids FICA taxes too."},
  {"type":"warning","text":"Your emergency fund covers only 0.8 months of expenses — well below the recommended 3-6 months."},
  {"type":"success","text":"You'll be debt-free in 14 months, right before your home purchase timeline — perfect for redirecting payments to a down payment fund."}
]`,
    messages: [
      {
        role: 'user',
        content: `Generate insights for this user's financial situation:\n\n${context}`,
      },
    ],
  });

  const raw = message.content[0]?.type === 'text' ? message.content[0].text : '[]';

  try {
    const items = JSON.parse(raw.replace(/^```json\n?/, '').replace(/\n?```$/, ''));
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
