'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { BudgetForm } from './BudgetForm';
import { formatCurrency } from '@/lib/format';
import { CATEGORY_ICONS } from '@/lib/constants';
import type { CategorySummary } from '@/types/finance';
import { cn } from '@/lib/utils';

interface Props {
  summary: CategorySummary;
}

export function BudgetCard({ summary }: Props) {
  const { category, spent, budgeted, percentage } = summary;
  const [editOpen, setEditOpen] = useState(false);

  const barColor =
    percentage > 100
      ? 'bg-red-500'
      : percentage > 80
      ? 'bg-yellow-500'
      : 'bg-green-500';

  return (
    <>
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">{CATEGORY_ICONS[category]}</span>
              <span className="font-medium">{category}</span>
              {percentage > 100 && (
                <span className="text-xs text-red-500 font-medium">Over budget!</span>
              )}
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {formatCurrency(spent)} spent
              </span>
              <span className="text-muted-foreground">
                {budgeted > 0 ? `${formatCurrency(budgeted)} limit` : 'No limit set'}
              </span>
            </div>

            {budgeted > 0 ? (
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn('h-full transition-all', barColor)}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>
            ) : (
              <Progress value={0} className="h-2" />
            )}

            {budgeted > 0 && (
              <p className="text-xs text-muted-foreground text-right">
                {percentage.toFixed(0)}% used
                {budgeted > spent && ` · ${formatCurrency(budgeted - spent)} left`}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <BudgetForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        category={category}
        currentLimit={budgeted}
      />
    </>
  );
}
