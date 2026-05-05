'use client';

import { useState, useMemo, useRef, type ChangeEvent } from 'react';
import { Plus, Search, Upload, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TransactionRow } from './TransactionRow';
import { TransactionForm } from './TransactionForm';
import { useFinanceStore } from '@/lib/store';
import { getMonthOptions, formatMonth } from '@/lib/format';
import { useCurrentMonth } from '@/lib/hooks';
import { CATEGORIES } from '@/lib/constants';
import { detectRecurringExpenses, parseTransactionsCsv } from '@/lib/transactions';
import type { Transaction, Category } from '@/types/finance';

export function TransactionList() {
  const transactions = useFinanceStore((s) => s.transactions);
  const addTransactionsBulk = useFinanceStore((s) => s.addTransactionsBulk);
  const currentMonth = useCurrentMonth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [month, setMonth] = useState(currentMonth);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<Category | 'All'>('All');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const monthOptions = getMonthOptions(12);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (!t.date.startsWith(month)) return false;
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (categoryFilter !== 'All' && t.category !== categoryFilter) return false;
      if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [transactions, month, typeFilter, categoryFilter, search]);

  const handleEdit = (t: Transaction) => {
    setEditing(t);
    setFormOpen(true);
  };

  const handleClose = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const recurring = useMemo(() => detectRecurringExpenses(transactions), [transactions]);
  const upcomingRecurring = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 21);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return recurring.filter((r) => r.nextDueDate >= today && r.nextDueDate <= cutoffStr).slice(0, 6);
  }, [recurring]);

  const upcomingTotal = useMemo(
    () => upcomingRecurring.reduce((sum, r) => sum + r.averageAmount, 0),
    [upcomingRecurring]
  );

  const handleImportClick = () => fileInputRef.current?.click();

  const handleCsvImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      const parsed = parseTransactionsCsv(content);
      if (!parsed.length) {
        setImportStatus('No valid rows found. Make sure your CSV includes date, description, and amount columns.');
        return;
      }
      const before = transactions.length;
      addTransactionsBulk(parsed);
      const after = useFinanceStore.getState().transactions.length;
      const added = after - before;
      const skipped = parsed.length - added;
      setImportStatus(`Imported ${added} transactions${skipped > 0 ? `, skipped ${skipped} duplicates` : ''}.`);
    } catch {
      setImportStatus('Import failed. Please try a standard bank CSV file.');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleCsvImport}
          />
          <Button variant="outline" onClick={handleImportClick}>
            <Upload className="mr-2 h-4 w-4" />Import CSV
          </Button>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />Add Transaction
          </Button>
        </div>
      </div>

      {importStatus ? (
        <div className="rounded-lg border border-[#87aeb6] bg-[#e2efef] px-3 py-2 text-sm text-[#1d4f60]">
          {importStatus}
        </div>
      ) : null}

      <div className="rounded-lg border border-[#b8cbd0] bg-[#edf4f4] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Repeat className="h-4 w-4 text-[#2f7f74]" />
            <p className="text-sm font-semibold text-[#103248]">Upcoming recurring expenses (next 21 days)</p>
          </div>
          <Badge variant="secondary" className="bg-[#d5e7e4] text-[#11443e]">
            {upcomingRecurring.length} upcoming • ${upcomingTotal.toFixed(2)}
          </Badge>
        </div>
        {upcomingRecurring.length === 0 ? (
          <p className="text-sm text-[#4b6274]">Add/import a few months of transactions and recurring subscriptions will appear here.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingRecurring.map((item) => (
              <div key={`${item.description}-${item.nextDueDate}`} className="rounded-md border border-[#c0d2d5] bg-[#f4f8f7] p-3">
                <p className="truncate text-sm font-medium text-[#11354d]">{item.description}</p>
                <p className="text-xs text-[#496378]">{item.category}</p>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-[#355267]">Due {item.nextDueDate}</span>
                  <span className="font-semibold text-[#11443e]">${item.averageAmount.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
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

        <Select value={typeFilter} onValueChange={(v) => v && setTypeFilter(v as typeof typeFilter)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={(v) => v && setCategoryFilter(v as Category | 'All')}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">No transactions found</p>
          <p className="text-sm mt-1">Try adjusting your filters or add a new transaction.</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TransactionRow key={t.id} transaction={t} onEdit={handleEdit} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TransactionForm open={formOpen} onClose={handleClose} editing={editing} />
    </div>
  );
}
