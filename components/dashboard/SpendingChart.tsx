'use client';

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCategorySummaries } from '@/lib/hooks';
import { CATEGORY_COLORS } from '@/lib/constants';
import { formatCurrency } from '@/lib/format';

interface Props {
  month: string;
}

export function SpendingChart({ month }: Props) {
  const summaries = useCategorySummaries(month);
  const data = summaries
    .filter((s) => s.spent > 0)
    .map((s) => ({ name: s.category, value: s.spent }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Spending by Category</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            No expenses recorded this month
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={CATEGORY_COLORS[entry.name as keyof typeof CATEGORY_COLORS]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(val) => typeof val === 'number' ? formatCurrency(val) : val} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
