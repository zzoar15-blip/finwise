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
    <div className="space-y-6 max-w-6xl">
      <div className="rounded-2xl border border-[#dbe4f0] bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4f6487]">Overview</p>
            <h1 className="mt-1 text-2xl font-bold text-[#0f1f39]">Financial Dashboard</h1>
          </div>
          <Select value={month} onValueChange={(v) => v && setMonth(v)}>
            <SelectTrigger className="w-44 border-[#d8e2f0] bg-white">
              <SelectValue>{formatMonth(month)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <SummaryCards month={month} />

      <div className="grid gap-4 lg:grid-cols-2">
        <SpendingChart month={month} />
        <RecentTransactions month={month} />
      </div>
    </div>
  );
}
