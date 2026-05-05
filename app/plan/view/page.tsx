'use client';

import { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import LZString from 'lz-string';
import { formatCurrency } from '@/lib/format';
import { PageSkeleton } from '@/components/ui/page-skeleton';

function SharedPlanViewContent() {
  const searchParams = useSearchParams();
  const encoded = searchParams.get('d') || '';
  const data = useMemo(() => {
    try {
      const decoded = LZString.decompressFromEncodedURIComponent(encoded || '');
      return decoded ? JSON.parse(decoded) : null;
    } catch {
      return null;
    }
  }, [encoded]);

  if (!data) {
    return <div className="mx-auto max-w-3xl p-8 text-sm text-muted-foreground">Invalid or missing shared plan link.</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        Viewing {data.name}&apos;s financial plan —{' '}
        <Link href="/" className="font-semibold underline">Create your own free plan at FinWise</Link>
      </div>
      <h1 className="text-2xl font-bold">{data.name}&apos;s Plan (Read-only)</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Annual salary" value={formatCurrency(data.annualSalary)} />
        <Card label="Monthly surplus" value={formatCurrency(data.monthlySurplus)} />
        <Card label="Savings rate" value={`${Number(data.savingsRate).toFixed(1)}%`} />
        <Card label="Debt-free date" value={data.debtFreeDate || '—'} />
      </div>
      <div className="rounded-lg border p-4">
        <p className="text-sm font-semibold">Goals</p>
        <p className="mt-1 text-sm text-muted-foreground">{(data.goals || []).join(', ') || 'None selected'}</p>
      </div>
      <div className="rounded-lg border p-4">
        <p className="text-sm font-semibold">Debt summary</p>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          {(data.debts || []).map((d: { id: string; balance: number; apr: number }) => (
            <li key={d.id}>{d.id}: {formatCurrency(d.balance)} @ {d.apr}%</li>
          ))}
        </ul>
      </div>
      <Link href="/" className="inline-flex rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
        Build my plan →
      </Link>
    </div>
  );
}

export default function SharedPlanViewPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SharedPlanViewContent />
    </Suspense>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

