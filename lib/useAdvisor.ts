'use client';

import { useState, useCallback, useRef } from 'react';
import { useFinanceStore } from '@/lib/store';
import { useFinWiseStore } from '@/lib/store';
import { formatCurrency } from '@/lib/format';
import { getBonusAllocationAmounts, monthName } from '@/lib/bonusProfile';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function buildFinancialContext(
  financeStore: ReturnType<typeof useFinanceStore.getState>,
  planningStore: ReturnType<typeof useFinWiseStore.getState>
): string {
  const { transactions, budgets } = financeStore;

  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const monthTx = transactions.filter((t) => t.date.startsWith(ym));
  const income = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  // Category breakdown
  const byCategory: Record<string, number> = {};
  for (const t of monthTx.filter((t) => t.type === 'expense')) {
    byCategory[t.category] = (byCategory[t.category] ?? 0) + t.amount;
  }
  const catLines = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => `  - ${cat}: ${formatCurrency(amt)}`)
    .join('\n');

  // Budget usage
  const budgetLines = budgets
    .map((b) => {
      const spent = byCategory[b.category] ?? 0;
      const pct = b.monthlyLimit > 0 ? Math.round((spent / b.monthlyLimit) * 100) : 0;
      return `  - ${b.category}: ${formatCurrency(spent)} / ${formatCurrency(b.monthlyLimit)} (${pct}%)`;
    })
    .join('\n');

  const lines: string[] = [
    `Current month (${ym}):`,
    `  Income: ${formatCurrency(income)}`,
    `  Expenses: ${formatCurrency(expenses)}`,
    `  Net: ${formatCurrency(income - expenses)}`,
  ];

  if (catLines) {
    lines.push(`\nSpending by category:\n${catLines}`);
  }

  if (budgetLines) {
    lines.push(`\nBudget tracking:\n${budgetLines}`);
  }

  lines.push(`\nTotal transactions on record: ${transactions.length}`);

  const transportTotal =
    planningStore.budgetInputs.carPayment +
    planningStore.budgetInputs.carInsurance +
    planningStore.budgetInputs.gas +
    planningStore.budgetInputs.parking +
    planningStore.budgetInputs.publicTransit +
    planningStore.budgetInputs.otherTransport;
  lines.push('\nLive planning snapshot:');
  lines.push(`  Gross annual: ${formatCurrency(planningStore.paycheckResults.grossAnnual)}`);
  lines.push(`  Net monthly: ${formatCurrency(planningStore.paycheckResults.netPayMonthly)}`);
  lines.push(`  Monthly housing: ${formatCurrency(planningStore.budgetInputs.housing)}`);
  lines.push(`  Monthly transportation: ${formatCurrency(transportTotal)}`);
  lines.push(`  Debts tracked: ${planningStore.debts.length}`);

  const bp = planningStore.bonusProfile;
  if (bp && bp.frequency !== 'none' && bp.annualBonusAmount > 0) {
    const a = getBonusAllocationAmounts(bp);
    lines.push('');
    lines.push('BONUS (post-tax):');
    lines.push(`  Annual bonus: ${formatCurrency(bp.annualBonusAmount)}`);
    lines.push(`  Paid in: ${monthName(bp.bonusMonth)}`);
    lines.push(`  Allocation — Debt ${bp.allocations.debtPayoff}% (${formatCurrency(a.debtPayoff)}), EF ${bp.allocations.emergencyFund}% (${formatCurrency(a.emergencyFund)}), Home ${bp.allocations.homeDownPayment}% (${formatCurrency(a.homeDownPayment)}), Brokerage ${bp.allocations.brokerage}% (${formatCurrency(a.brokerage)}), Roth ${bp.allocations.rothIra}% (${formatCurrency(a.rothIra)}), Cash ${bp.allocations.cash}% (${formatCurrency(a.cash)})`);
  }

  return lines.join('\n');
}

function buildRentVsBuyContext(store: ReturnType<typeof useFinWiseStore.getState>): string {
  const { rentVsBuyInputs, rentVsBuyResults } = store;
  if (!rentVsBuyInputs || !rentVsBuyResults) return '';
  return [
    'RENT VS BUY ANALYSIS:',
    `Purchase price: ${formatCurrency(rentVsBuyInputs.purchasePrice)}`,
    `Monthly rent: ${formatCurrency(rentVsBuyInputs.monthlyRent)}`,
    `Planned stay: ${rentVsBuyInputs.plannedStayYears} years`,
    `Break-even: ${rentVsBuyResults.breakEvenYear ? `${rentVsBuyResults.breakEvenYear.toFixed(1)} years` : 'Never'}`,
    `At planned stay: ${rentVsBuyResults.plannedStayResult.winner} wins by ${formatCurrency(rentVsBuyResults.plannedStayResult.difference)}`,
    `Price-to-rent ratio: ${rentVsBuyResults.priceToRentRatio.toFixed(1)} (${rentVsBuyResults.priceToRentInterpretation})`,
    `True monthly cost buying: ${formatCurrency(rentVsBuyResults.trueMonthlyCostBuying)} vs renting: ${formatCurrency(rentVsBuyResults.trueMonthlyCostRenting)}`,
  ].join('\n');
}

export function useAdvisor() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const financialContext = useCallback(() => {
    const txStore = useFinanceStore.getState();
    const planningStore = useFinWiseStore.getState();
    const base = buildFinancialContext(txStore, planningStore);
    const rvb = buildRentVsBuyContext(planningStore);
    return rvb ? `${base}\n\n${rvb}` : base;
  }, []);

  const send = useCallback(async (userText: string) => {
    if (!userText.trim() || streaming) return;

    const userMsg: Message = { role: 'user', content: userText.trim() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setStreaming(true);
    setError(null);

    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          financialContext: financialContext(),
          newMessage: userText.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const assistantMsg: Message = { role: 'assistant', content: '' };
      setMessages((prev) => [...prev, assistantMsg]);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            ...copy[copy.length - 1],
            content: copy[copy.length - 1].content + chunk,
          };
          return copy;
        });
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError((err as Error).message);
      setMessages((prev) => prev.slice(0, -1)); // remove empty assistant bubble
    } finally {
      setStreaming(false);
    }
  }, [messages, streaming, financialContext]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setStreaming(false);
    setError(null);
  }, []);

  return { messages, streaming, error, send, stop, clear };
}
