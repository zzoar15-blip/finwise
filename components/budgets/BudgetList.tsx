'use client';

import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BudgetCard } from './BudgetCard';
import { useCategorySummaries, useCurrentMonth } from '@/lib/hooks';
import { getMonthOptions, formatMonth } from '@/lib/format';

export function BudgetList() {
  const currentMonth = useCurrentMonth();
  const [month, setMonth] = useState(currentMonth);
  const summaries = useCategorySummaries(month);
  const monthOptions = getMonthOptions(12);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Budgets</h1>
        <Select value={month} onValueChange={(v) => v && setMonth(v)}>
          <SelectTrigger className="w-44">
            <SelectValue>{formatMonth(month)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">
        Set monthly spending limits per category. Click the pencil icon on any card to edit.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {summaries.map((s) => (
          <BudgetCard key={s.category} summary={s} />
        ))}
      </div>
    </div>
  );
}
