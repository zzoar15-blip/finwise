'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wallet, Check, Download, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { usePlanStore } from '@/lib/planStore';
import { useFinanceStore } from '@/lib/store';
import { STATE_CONFIGS } from '@/lib/stateTax';
import { CATEGORIES } from '@/lib/constants';
import { PageHeader } from '@/components/layout/PageHeader';
import BonusAllocationSection from '@/components/bonus/BonusAllocationSection';

export default function SettingsPage() {
  const router = useRouter();

  const { plan, settings, updateSettings, clearPlan } = usePlanStore();
  const transactions = useFinanceStore((s) => s.transactions);
  const budgets = useFinanceStore((s) => s.budgets);

  const [displayName, setDisplayName] = useState(settings.displayName);
  const [defaultState, setDefaultState] = useState(settings.defaultState);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    updateSettings({ displayName, defaultState });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleExport() {
    const data = {
      plan,
      transactions,
      budgets,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finwise-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleReset() {
    clearPlan();
    useFinanceStore.setState({
      transactions: [],
      budgets: CATEGORIES.map((c) => ({ category: c, monthlyLimit: 0 })),
    });
    router.push('/');
  }

  function handleRestartSetup() {
    updateSettings({ acceptedInstitutionalDisclosure: true });
    router.push('/?wizard=true');
  }

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <PageHeader
        title="Settings"
        subtitle="Manage profile defaults and protect your data lifecycle."
      />

      <BonusAllocationSection />

      {/* Profile */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Personalise how FinWise greets you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="display-name">Display Name</Label>
            <Input
              id="display-name"
              placeholder="e.g. Alex"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="default-state">Default State</Label>
            <Select value={defaultState} onValueChange={(v) => v && setDefaultState(v)}>
              <SelectTrigger id="default-state">
                <SelectValue placeholder="Select a state" />
              </SelectTrigger>
              <SelectContent>
                {STATE_CONFIGS.map((s) => (
                  <SelectItem key={s.abbr} value={s.abbr}>
                    {s.name} ({s.abbr})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button onClick={handleSave}>Save</Button>
            {saved && (
              <Badge variant="outline" className="gap-1 border-green-200 bg-green-50 text-green-700">
                <Check className="h-3 w-3" />
                Saved!
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>Export or permanently delete your FinWise data.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4 rounded-lg border border-blue-100 bg-blue-50 p-4">
            <div>
              <p className="text-sm font-medium text-blue-900">Restart setup wizard</p>
              <p className="mt-0.5 text-xs text-blue-700">
                Re-run onboarding to refresh salary, budget, debts, and goals.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleRestartSetup} className="shrink-0 border-blue-200 text-blue-800">
              Restart setup
            </Button>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
            <div>
              <p className="text-sm font-medium text-gray-800">Export all data</p>
              <p className="mt-0.5 text-xs text-gray-500">
                Download your financial plan, transactions and budgets as a JSON file.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport} className="shrink-0">
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export JSON
            </Button>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border border-red-100 bg-red-50 p-4">
            <div>
              <p className="text-sm font-medium text-red-800">Reset all data</p>
              <p className="mt-0.5 text-xs text-red-600">
                Permanently deletes your financial plan and all transaction history.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger className="inline-flex shrink-0 items-center rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 transition-colors">
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Reset
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete your Financial Plan and all transaction history. This cannot be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleReset}
                    className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                  >
                    Reset Everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#3b82f6]">
              <Wallet className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-base font-bold text-gray-900">FinWise</p>
              <p className="text-sm text-gray-500">Version 1.0.0</p>
              <p className="mt-0.5 text-sm text-gray-500">Your personal financial planning tool</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
