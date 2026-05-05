'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Gift, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFinWiseStore } from '@/lib/store';
import {
  DEFAULT_BONUS_PROFILE,
  getBonusAllocationAmounts,
  monthName,
  normalizeBonusAllocations,
  type BonusAllocations,
} from '@/lib/bonusProfile';
import { formatCurrency } from '@/lib/format';
import { computeTotalExpenses } from '@/lib/calculations';

const ALLOC_META: Array<{
  key: keyof BonusAllocations;
  label: string;
  emoji: string;
  bar: string;
}> = [
  { key: 'debtPayoff', label: 'Debt payoff', emoji: '💳', bar: '#dc2626' },
  { key: 'emergencyFund', label: 'Emergency fund', emoji: '🏦', bar: '#d97706' },
  { key: 'homeDownPayment', label: 'Home down payment', emoji: '🏠', bar: '#8b5cf6' },
  { key: 'brokerage', label: 'Brokerage / investing', emoji: '📈', bar: '#3b82f6' },
  { key: 'rothIra', label: 'Roth IRA', emoji: '🔄', bar: '#0891b2' },
  { key: 'cash', label: 'Cash / spending', emoji: '💰', bar: '#64748b' },
];

export default function BonusAllocationSection({
  showHeader = true,
}: {
  showHeader?: boolean;
}) {
  const bonusProfile = useFinWiseStore((s) => s.bonusProfile);
  const setBonusProfile = useFinWiseStore((s) => s.setBonusProfile);
  const budgetInputs = useFinWiseStore((s) => s.budgetInputs);

  const [savedFlash, setSavedFlash] = useState(false);

  const amounts = useMemo(() => getBonusAllocationAmounts(bonusProfile), [bonusProfile]);
  const totalPct = useMemo(
    () => ALLOC_META.reduce((s, { key }) => s + bonusProfile.allocations[key], 0),
    [bonusProfile.allocations],
  );

  const monthlyExpenses = useMemo(() => computeTotalExpenses(budgetInputs), [budgetInputs]);

  function patchAlloc(key: keyof BonusAllocations, pct: number) {
    setBonusProfile({
      allocations: normalizeBonusAllocations({
        ...bonusProfile.allocations,
        [key]: pct,
      }),
    });
  }

  function autoBalance() {
    const a = { ...bonusProfile.allocations };
    const keys = ALLOC_META.map((x) => x.key);
    const nonzero = keys.filter((k) => a[k] > 0);
    if (nonzero.length === 0) return;
    const shortfall = 100 - totalPct;
    const each = Math.floor(shortfall / nonzero.length);
    let rem = shortfall - each * nonzero.length;
    const next = { ...a };
    for (const k of nonzero) {
      next[k] += each + (rem > 0 ? 1 : 0);
      if (rem > 0) rem -= 1;
    }
    setBonusProfile({ allocations: normalizeBonusAllocations(next) });
  }

  function handleSave() {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  }

  return (
    <Card className="border-[#e9d5ff] shadow-sm">
      {showHeader && (
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <Gift className="size-5 text-[#8b5cf6]" />
            <CardTitle className="text-xl font-bold text-[#0f172a]">Annual Bonus Allocation</CardTitle>
          </div>
          <CardDescription>
            Tell FinWise how to split your bonus so every forecast reflects your actual plan.
          </CardDescription>
        </CardHeader>
      )}
      <CardContent className="space-y-8">
        <section className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Bonus details
          </p>
          <div className="flex flex-wrap gap-2">
            {(['annual', 'semiannual', 'none'] as const).map((fid) => (
              <button
                key={fid}
                type="button"
                onClick={() =>
                  setBonusProfile({
                    frequency: fid === 'annual' ? 'annual' : fid === 'semiannual' ? 'semiannual' : 'none',
                  })
                }
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  (fid === 'annual' && bonusProfile.frequency === 'annual') ||
                  (fid === 'semiannual' && bonusProfile.frequency === 'semiannual') ||
                  (fid === 'none' && bonusProfile.frequency === 'none')
                    ? 'bg-[#8b5cf6] text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {fid === 'annual' ? 'Annual' : fid === 'semiannual' ? 'Semi-annual' : 'No bonus'}
              </button>
            ))}
          </div>

          {bonusProfile.frequency !== 'none' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Annual bonus (post-tax)</Label>
                <Input
                  type="number"
                  min={0}
                  step={100}
                  value={bonusProfile.annualBonusAmount || ''}
                  onChange={(e) =>
                    setBonusProfile({ annualBonusAmount: Math.max(0, parseFloat(e.target.value) || 0) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Bonus month</Label>
                <Select
                  value={String(bonusProfile.bonusMonth)}
                  onValueChange={(v) => setBonusProfile({ bonusMonth: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {monthName(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {bonusProfile.frequency === 'semiannual' && (
                <>
                  <div className="space-y-2">
                    <Label>Second bonus (post-tax)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={100}
                      value={bonusProfile.secondBonusAmount || ''}
                      onChange={(e) =>
                        setBonusProfile({
                          secondBonusAmount: Math.max(0, parseFloat(e.target.value) || 0),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Second bonus month</Label>
                    <Select
                      value={String(bonusProfile.secondBonusMonth)}
                      onValueChange={(v) => setBonusProfile({ secondBonusMonth: Number(v) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <SelectItem key={m} value={String(m)}>
                            {monthName(m)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Enter the amount after taxes. For a W-2 employee this is what hits your bank account.
          </p>
        </section>

        {bonusProfile.frequency !== 'none' && (
          <>
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  How to split it
                </p>
                <Button type="button" variant="outline" size="sm" onClick={autoBalance}>
                  Auto-balance remaining
                </Button>
              </div>
              <div className="space-y-4">
                {ALLOC_META.map(({ key, label, emoji }) => (
                  <div key={key} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                    <span className="flex min-w-[200px] items-center gap-2 text-sm">
                      <span>{emoji}</span>
                      <span>{label}</span>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={bonusProfile.allocations[key]}
                      onChange={(e) => patchAlloc(key, Number(e.target.value))}
                      className="flex-1 accent-[#8b5cf6]"
                    />
                    <span className="w-14 text-right text-sm font-semibold tabular-nums">
                      {bonusProfile.allocations[key]}%
                    </span>
                    <span className="w-28 text-right text-xs tabular-nums text-muted-foreground">
                      = {formatCurrency(amounts[key])}
                    </span>
                  </div>
                ))}
              </div>
              <div
                className={`rounded-lg border px-3 py-2 text-sm ${
                  totalPct === 100
                    ? 'border-green-200 bg-green-50 text-green-900'
                    : 'border-red-200 bg-red-50 text-red-900'
                }`}
              >
                {totalPct === 100 ? (
                  <span>✓ 100% allocated</span>
                ) : (
                  <span>⚠ {totalPct}% allocated — must equal 100%</span>
                )}
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Allocation mix
              </p>
              <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
                {ALLOC_META.map(({ key, bar }) => (
                  <div
                    key={key}
                    className="h-full transition-all"
                    style={{
                      width: `${bonusProfile.allocations[key]}%`,
                      backgroundColor: bar,
                    }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                {ALLOC_META.map(({ key, label }) => (
                  <span key={key}>
                    {label}: {formatCurrency(amounts[key])}
                  </span>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-dashed border-[#c4b5fd] bg-[#faf5ff] p-4 space-y-3">
              <p className="text-sm font-semibold text-[#0f172a]">How this affects your plan</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md bg-white p-3 text-sm shadow-sm">
                  <p className="text-xs text-muted-foreground">Debt payoff</p>
                  <p className="font-semibold tabular-nums">{formatCurrency(amounts.debtPayoff)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Allocated from bonus toward principal
                  </p>
                </div>
                <div className="rounded-md bg-white p-3 text-sm shadow-sm">
                  <p className="text-xs text-muted-foreground">Investing (brokerage)</p>
                  <p className="font-semibold tabular-nums">{formatCurrency(amounts.brokerage)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Annual DRIP deposit(s)</p>
                </div>
                <div className="rounded-md bg-white p-3 text-sm shadow-sm">
                  <p className="text-xs text-muted-foreground">Home savings</p>
                  <p className="font-semibold tabular-nums">{formatCurrency(amounts.homeDownPayment)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Toward down payment goal</p>
                </div>
                <div className="rounded-md bg-white p-3 text-sm shadow-sm">
                  <p className="text-xs text-muted-foreground">Emergency fund</p>
                  <p className="font-semibold tabular-nums">{formatCurrency(amounts.emergencyFund)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    ~{(amounts.emergencyFund / Math.max(1, monthlyExpenses)).toFixed(1)} mo expenses
                  </p>
                </div>
              </div>
            </section>
          </>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            className="bg-[#8b5cf6] hover:bg-[#7c3aed]"
            onClick={handleSave}
            disabled={totalPct !== 100 && bonusProfile.frequency !== 'none'}
          >
            {savedFlash ? 'Saved' : 'Save allocation'}
          </Button>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setBonusProfile(DEFAULT_BONUS_PROFILE)}
          >
            <RefreshCw className="size-3.5" />
            Reset to defaults
          </button>
          <Link href="/plan" className="text-sm font-medium text-[#3b82f6] hover:underline">
            View on My Plan →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
