'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useFinanceStore } from '@/lib/store';
import { formatCurrency, formatDate } from '@/lib/format';
import { CATEGORY_ICONS } from '@/lib/constants';

interface Props {
  month: string;
}

export function RecentTransactions({ month }: Props) {
  const allTransactions = useFinanceStore((s) => s.transactions);
  const transactions = useMemo(
    () => allTransactions.filter((t) => t.date.startsWith(month)).slice(0, 5),
    [allTransactions, month]
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Recent Transactions</CardTitle>
        <Link href="/transactions" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No transactions this month
          </p>
        ) : (
          <div className="space-y-3">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{CATEGORY_ICONS[t.category]}</span>
                  <div>
                    <p className="text-sm font-medium leading-none">{t.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(t.date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs hidden sm:inline-flex">
                    {t.category}
                  </Badge>
                  <span className={`text-sm font-semibold ${t.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
