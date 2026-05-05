'use client';

import { TrendingUp, TrendingDown, Wallet, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMonthSummary } from '@/lib/hooks';
import { formatCurrency } from '@/lib/format';
import { useFinWiseStore } from '@/lib/store';
import { usePlanStore } from '@/lib/planStore';
import { simulateDebtPayoff } from '@/lib/calculations/debt';

interface Props {
  month: string;
}

export function SummaryCards({ month }: Props) {
  const { income, expenses, net } = useMonthSummary(month);
  const debts = useFinWiseStore((s) => s.debts);
  const debtProfile = usePlanStore((s) => s.debtProfile);
  const effectiveDebts = debtProfile?.debts?.length ? debtProfile.debts : debts;
  const hasDebts = effectiveDebts.some((d) => d.balance > 0);
  const debtResult = hasDebts
    ? simulateDebtPayoff(
      effectiveDebts.map((d) => ({
        id: d.id,
        name: d.name,
        balance: d.balance,
        apr: d.apr,
        minPayment: d.minPayment,
      })),
      Math.max(0, debtProfile?.monthlyOverpayment ?? 0),
      Math.max(0, debtProfile?.annualBonus ?? 0),
      debtProfile?.bonusMonth ?? 2,
      debtProfile?.strategy ?? 'avalanche',
    )
    : null;
  const debtFreeDateLabel = debtResult?.debtFreeDate
    ? new Date(`${debtResult.debtFreeDate}-01`).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    })
    : 'Debt free! ✓';

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Income</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{formatCurrency(income)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Expenses</CardTitle>
          <TrendingDown className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-500">{formatCurrency(expenses)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Net Balance</CardTitle>
          <Wallet className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${net >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {formatCurrency(net)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Debt-Free Date</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${hasDebts ? 'text-foreground' : 'text-green-600'}`}>
            {debtFreeDateLabel}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
