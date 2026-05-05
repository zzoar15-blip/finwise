'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { useFinWiseStore } from '@/lib/store';
import { computeNetWorthTotals } from '@/lib/calculations/netWorth';
import { formatCurrency } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExportButton } from '@/components/ExportButton';
import { downloadCsv, downloadXlsxFromAoa } from '@/lib/export';
import { PDFDownloadButton } from '@/components/pdf/PDFDownloadButton';
import { SimpleRowsPDF } from '@/lib/pdf/SimpleRowsPDF';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyChart } from '@/components/ui/empty-chart';
import { DollarSign } from 'lucide-react';

export default function NetWorthPage() {
  const assets = useFinWiseStore((s) => s.netWorthAssets);
  const liabilities = useFinWiseStore((s) => s.netWorthLiabilities);
  const history = useFinWiseStore((s) => s.netWorthHistory);
  const setAssets = useFinWiseStore((s) => s.setNetWorthAssets);
  const setLiabilities = useFinWiseStore((s) => s.setNetWorthLiabilities);
  const addSnapshot = useFinWiseStore((s) => s.addNetWorthSnapshot);
  const paycheck = useFinWiseStore((s) => s.paycheckResults);
  const budget = useFinWiseStore((s) => s.budgetInputs);
  const debts = useFinWiseStore((s) => s.debts);
  const [assumedReturnPct, setAssumedReturnPct] = useState(7);
  const [monthsSaved, setMonthsSaved] = useState(12);

  useEffect(() => {
    const autoDebtLiabilities = debts.map((d) => ({
      id: `auto-debt-${d.id}`,
      name: d.name,
      amount: d.balance,
      category: 'Debt',
    }));
    const manual = liabilities.filter((l) => !l.id.startsWith('auto-debt-'));
    const merged = [...autoDebtLiabilities, ...manual];
    const same =
      merged.length === liabilities.length &&
      merged.every((m, i) => liabilities[i]?.id === m.id && liabilities[i]?.amount === m.amount && liabilities[i]?.name === m.name);
    if (!same) setLiabilities(merged);
  }, [debts, liabilities, setLiabilities]);

  useEffect(() => {
    const emergencyFundEstimate = budget.emergencyFundMonthly * monthsSaved;
    const existing = assets.find((a) => a.id === 'auto-emergency-fund');
    if (!existing) {
      setAssets([{ id: 'auto-emergency-fund', name: 'Emergency Fund (est.)', amount: emergencyFundEstimate, category: 'Cash' }, ...assets]);
      return;
    }
    if (existing.amount !== emergencyFundEstimate) {
      setAssets(assets.map((a) => (a.id === 'auto-emergency-fund' ? { ...a, amount: emergencyFundEstimate } : a)));
    }
  }, [budget.emergencyFundMonthly, monthsSaved, assets, setAssets]);

  const totals = useMemo(() => computeNetWorthTotals(assets, liabilities), [assets, liabilities]);

  const rows = useMemo<(string | number)[][]>(
    () => [
      ['Date', 'Assets', 'Liabilities', 'Net Worth'],
      ...history.map((h) => [h.date, h.assets, h.liabilities, h.netWorth]),
    ],
    [history],
  );

  const chartData = useMemo(() => history.map((h) => ({ date: h.date, netWorth: h.netWorth })), [history]);
  const syncedContributionMonthly =
    (paycheck.k401TraditionalAnnual + paycheck.k401RothAnnual) / 12 +
    budget.rothIraMonthly +
    budget.brokerageMonthly;

  const forecastData = useMemo(() => {
    const points: Array<{ month: string; netWorth: number }> = [];
    const now = new Date();
    const monthlyReturn = Math.max(0, assumedReturnPct) / 100 / 12;
    let projected = totals.netWorth;
    for (let i = 1; i <= 60; i += 1) {
      projected = (projected + syncedContributionMonthly) * (1 + monthlyReturn);
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      points.push({
        month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        netWorth: projected,
      });
    }
    return points;
  }, [totals.netWorth, syncedContributionMonthly, assumedReturnPct]);

  function updateAsset(id: string, patch: Partial<(typeof assets)[number]>) {
    setAssets(assets.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function updateLiability(id: string, patch: Partial<(typeof liabilities)[number]>) {
    setLiabilities(liabilities.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function addAsset() {
    setAssets([
      ...assets,
      { id: `asset-${Date.now()}`, name: 'New Asset', amount: 0, category: 'Other' },
    ]);
  }

  function addLiability() {
    setLiabilities([
      ...liabilities,
      { id: `liability-${Date.now()}`, name: 'New Liability', amount: 0, category: 'Other' },
    ]);
  }

  function removeAsset(id: string) {
    setAssets(assets.filter((a) => a.id !== id));
  }

  function removeLiability(id: string) {
    setLiabilities(liabilities.filter((l) => l.id !== id));
  }

  return (
    <div id="net-worth-content" className="mx-auto max-w-[1280px] space-y-8">
      <PageHeader
        backHref="/"
        backLabel="Tools"
        title="Net Worth Tracker"
        subtitle="Track assets, liabilities, and momentum using snapshot history."
        actions={
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={() => addSnapshot()}
            >
              Save Snapshot
            </Button>
            <PDFDownloadButton
              className="flex-1 sm:flex-none"
              label="Export PDF"
              document={<SimpleRowsPDF title="Net Worth Tracker" rows={rows} />}
              fileName={`finwise-net-worth-${new Date().toISOString().slice(0, 10)}.pdf`}
            />
            <ExportButton
              onExportCsv={() => downloadCsv(rows, 'finwise-net-worth-history')}
              onExportXlsx={() => downloadXlsxFromAoa('Net Worth', rows, [12, 14, 14, 14], 'finwise-net-worth-history')}
            />
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Total Assets" value={formatCurrency(totals.assets)} />
        <Metric label="Total Liabilities" value={formatCurrency(totals.liabilities)} />
        <Metric label="Net Worth" value={formatCurrency(totals.netWorth)} isNet />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Assets</CardTitle>
            <Button size="sm" variant="outline" onClick={addAsset}>
              <Plus className="size-4" /> Add
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {assets.map((a) => (
              <div key={a.id} className="grid grid-cols-[1.3fr_0.8fr_0.8fr_auto] items-center gap-2">
                <Input value={a.name} onChange={(e) => updateAsset(a.id, { name: e.target.value })} />
                <Input value={a.category} onChange={(e) => updateAsset(a.id, { category: e.target.value })} />
                <Input
                  type="number"
                  value={a.amount || ''}
                  onChange={(e) => updateAsset(a.id, { amount: Number(e.target.value) || 0 })}
                />
                <Button size="icon" variant="ghost" onClick={() => removeAsset(a.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Liabilities</CardTitle>
            <Button size="sm" variant="outline" onClick={addLiability}>
              <Plus className="size-4" /> Add
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {liabilities.map((l) => (
              <div key={l.id} className="grid grid-cols-[1.3fr_0.8fr_0.8fr_auto] items-center gap-2">
                <Input value={l.name} onChange={(e) => updateLiability(l.id, { name: e.target.value })} />
                <Input value={l.category} onChange={(e) => updateLiability(l.id, { category: e.target.value })} />
                <Input
                  type="number"
                  value={l.amount || ''}
                  onChange={(e) => updateLiability(l.id, { amount: Number(e.target.value) || 0 })}
                />
                <Button size="icon" variant="ghost" onClick={() => removeLiability(l.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Net Worth History</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <EmptyChart
              icon={DollarSign}
              title="Start tracking your net worth"
              description="Add your assets and liabilities to see your net worth over time"
              height={240}
            />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(v) => (typeof v === 'number' ? formatCurrency(v) : String(v))} width={96} />
                <Tooltip formatter={(v) => (typeof v === 'number' ? formatCurrency(v) : String(v))} />
                <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="netWorth" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Projected Net Worth (5 years)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Synced Monthly Contributions" value={formatCurrency(syncedContributionMonthly)} />
            <Metric label="Assumed Annual Return" value={`${assumedReturnPct.toFixed(1)}%`} />
            <Metric label="Projected 5Y Net Worth" value={formatCurrency(forecastData[forecastData.length - 1]?.netWorth ?? totals.netWorth)} isNet />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Assumed annual return (%)</label>
            <input
              type="range"
              min={3}
              max={12}
              step={0.5}
              value={assumedReturnPct}
              onChange={(e) => setAssumedReturnPct(Number(e.target.value))}
              className="w-full accent-[#3b82f6]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Emergency fund months saved (estimate)</label>
            <Input type="number" min={1} max={120} value={monthsSaved} onChange={(e) => setMonthsSaved(Math.max(1, Number(e.target.value) || 1))} />
          </div>
          <p className="text-xs text-muted-foreground">
            Forecast uses synced contribution channels: 401(k), Roth IRA, and Brokerage from your Budget/Paycheck setup.
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={forecastData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tickFormatter={(v: string) => v.slice(2)} />
              <YAxis tickFormatter={(v) => (typeof v === 'number' ? formatCurrency(v) : String(v))} width={96} />
              <Tooltip formatter={(v) => (typeof v === 'number' ? formatCurrency(v) : String(v))} />
              <ReferenceLine y={totals.netWorth} stroke="#94a3b8" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="netWorth" stroke="#22c55e" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value, isNet = false }: { label: string; value: string; isNet?: boolean }) {
  return (
    <Card className="h-full shadow-sm">
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={`mt-1 text-2xl font-bold tabular-nums ${isNet ? 'text-[#3b82f6]' : ''}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
