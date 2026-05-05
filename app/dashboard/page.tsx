'use client';

import { useState } from 'react';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import { SpendingChart } from '@/components/dashboard/SpendingChart';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCurrentMonth } from '@/lib/hooks';
import { getMonthOptions, formatMonth } from '@/lib/format';

export default function DashboardPage() {
  const currentMonth = useCurrentMonth();
  const [month, setMonth] = useState(currentMonth);
  const monthOptions = getMonthOptions(12);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
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

      <SummaryCards month={month} />

      <div className="grid gap-4 lg:grid-cols-2">
        <SpendingChart month={month} />
        <RecentTransactions month={month} />
      </div>
    </div>
  );
}
