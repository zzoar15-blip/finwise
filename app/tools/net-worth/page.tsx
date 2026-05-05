'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ChevronLeft, Plus, Trash2, Wallet } from 'lucide-react';
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
import { exportDomToPdf } from '@/lib/exportPdf';

export default function NetWorthPage() {
  const assets = useFinWiseStore((s) => s.netWorthAssets);
  const liabilities = useFinWiseStore((s) => s.netWorthLiabilities);
  const history = useFinWiseStore((s) => s.netWorthHistory);
  const setAssets = useFinWiseStore((s) => s.setNetWorthAssets);
  const setLiabilities = useFinWiseStore((s) => s.setNetWorthLiabilities);
  const addSnapshot = useFinWiseStore((s) => s.addNetWorthSnapshot);

  const totals = useMemo(() => computeNetWorthTotals(assets, liabilities), [assets, liabilities]);

  const rows = useMemo<(string | number)[][]>(
    () => [
      ['Date', 'Assets', 'Liabilities', 'Net Worth'],
      ...history.map((h) => [h.date, h.assets, h.liabilities, h.netWorth]),
    ],
    [history],
  );

  const chartData = useMemo(() => history.map((h) => ({ date: h.date, netWorth: h.netWorth })), [history]);

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
    <div id="net-worth-content" className="mx-auto max-w-7xl space-y-6">
      <div className="space-y-2">
        <Link href="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-3" /> Tools
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <Wallet className="size-6 text-[#3b82f6] mt-0.5" />
            <div>
              <h1 className="text-2xl font-bold">Net Worth Tracker</h1>
              <p className="text-sm text-muted-foreground">
                Track assets, liabilities, and your net worth trend over time.
              </p>
            </div>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={() => addSnapshot()}
            >
              Save Snapshot
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={() => exportDomToPdf({ elementId: 'net-worth-content', filenamePrefix: 'finwise-net-worth' })}
            >
              Export PDF
            </Button>
            <ExportButton
              onExportCsv={() => downloadCsv(rows, 'finwise-net-worth-history')}
              onExportXlsx={() => downloadXlsxFromAoa('Net Worth', rows, [12, 14, 14, 14], 'finwise-net-worth-history')}
            />
          </div>
        </div>
      </div>

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
            <p className="text-sm text-muted-foreground">Save your first snapshot to start tracking trends.</p>
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
