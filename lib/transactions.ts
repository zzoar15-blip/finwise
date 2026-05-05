import type { Category, Transaction, TransactionType } from '@/types/finance';

const CATEGORY_RULES: Array<{ category: Category; keywords: string[] }> = [
  { category: 'Food', keywords: ['restaurant', 'cafe', 'coffee', 'uber eats', 'doordash', 'grocery', 'market'] },
  { category: 'Transport', keywords: ['uber', 'lyft', 'shell', 'chevron', 'exxon', 'gas', 'transit', 'parking'] },
  { category: 'Housing', keywords: ['rent', 'mortgage', 'hoa', 'landlord', 'property management', 'utilities'] },
  { category: 'Entertainment', keywords: ['netflix', 'spotify', 'hulu', 'disney', 'amc', 'cinema', 'steam'] },
  { category: 'Health', keywords: ['pharmacy', 'cvs', 'walgreens', 'hospital', 'clinic', 'medical', 'dentist'] },
  { category: 'Shopping', keywords: ['amazon', 'target', 'walmart', 'costco', 'best buy', 'shop'] },
  { category: 'Income', keywords: ['payroll', 'salary', 'deposit', 'income', 'bonus', 'refund'] },
];

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  out.push(current.trim());
  return out;
}

function parseDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const us = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (us) {
    const m = us[1].padStart(2, '0');
    const d = us[2].padStart(2, '0');
    const yy = us[3].length === 2 ? `20${us[3]}` : us[3];
    return `${yy}-${m}-${d}`;
  }
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

function parseAmount(raw: string): number | null {
  const sanitized = raw.replaceAll('$', '').replaceAll(',', '').trim();
  if (!sanitized) return null;
  const value = Number.parseFloat(sanitized);
  if (!Number.isFinite(value)) return null;
  return Math.abs(value);
}

function inferType(amountRaw: string, typeRaw?: string): TransactionType {
  const normalizedType = (typeRaw || '').trim().toLowerCase();
  if (normalizedType === 'income' || normalizedType === 'credit' || normalizedType === 'deposit') return 'income';
  if (normalizedType === 'expense' || normalizedType === 'debit') return 'expense';
  return amountRaw.trim().startsWith('-') ? 'expense' : 'income';
}

function inferCategory(description: string, type: TransactionType): Category {
  if (type === 'income') return 'Income';
  const text = description.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.category === 'Income') continue;
    if (rule.keywords.some((k) => text.includes(k))) return rule.category;
  }
  return 'Other';
}

function pickColumn(headers: string[], aliases: string[]): number {
  const lowered = headers.map((h) => h.toLowerCase());
  for (const alias of aliases) {
    const idx = lowered.findIndex((h) => h.includes(alias));
    if (idx >= 0) return idx;
  }
  return -1;
}

export function parseTransactionsCsv(csvText: string): Array<Omit<Transaction, 'id'>> {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map((h) => h.replace(/^"|"$/g, '').trim());
  const dateCol = pickColumn(headers, ['date', 'posted', 'transaction date']);
  const descCol = pickColumn(headers, ['description', 'merchant', 'payee', 'memo', 'name']);
  const amountCol = pickColumn(headers, ['amount', 'total']);
  const typeCol = pickColumn(headers, ['type', 'transaction type', 'debit/credit']);
  const categoryCol = pickColumn(headers, ['category']);
  if (dateCol < 0 || descCol < 0 || amountCol < 0) return [];

  const out: Array<Omit<Transaction, 'id'>> = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitCsvLine(lines[i]).map((c) => c.replace(/^"|"$/g, '').trim());
    const date = parseDate(cols[dateCol] || '');
    const amountRaw = cols[amountCol] || '';
    const amount = parseAmount(amountRaw);
    const description = (cols[descCol] || '').trim();
    if (!date || !amount || !description) continue;
    const type = inferType(amountRaw, typeCol >= 0 ? cols[typeCol] : undefined);
    const categoryValue = (categoryCol >= 0 ? cols[categoryCol] : '').trim() as Category;
    const category: Category = categoryValue || inferCategory(description, type);
    out.push({
      date,
      amount,
      type,
      category: (['Food', 'Transport', 'Housing', 'Entertainment', 'Health', 'Shopping', 'Income', 'Other'].includes(category)
        ? category
        : inferCategory(description, type)) as Category,
      description,
    });
  }
  return out;
}

export interface RecurringCandidate {
  description: string;
  category: Category;
  averageAmount: number;
  nextDueDate: string;
}

export function detectRecurringExpenses(transactions: Transaction[]): RecurringCandidate[] {
  const byDescription = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (t.type !== 'expense') continue;
    const key = t.description.trim().toLowerCase();
    if (!byDescription.has(key)) byDescription.set(key, []);
    byDescription.get(key)!.push(t);
  }

  const recurring: RecurringCandidate[] = [];
  for (const [key, list] of byDescription.entries()) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const sameMonthCount = new Set(sorted.map((t) => t.date.slice(0, 7))).size;
    if (sameMonthCount < 2) continue;
    const avgAmount = sorted.reduce((s, t) => s + t.amount, 0) / sorted.length;
    const last = sorted[sorted.length - 1];
    const lastDate = new Date(`${last.date}T00:00:00`);
    const nextDue = new Date(lastDate);
    nextDue.setDate(nextDue.getDate() + 30);
    recurring.push({
      description: key.replace(/\b\w/g, (c) => c.toUpperCase()),
      category: last.category,
      averageAmount: avgAmount,
      nextDueDate: nextDue.toISOString().slice(0, 10),
    });
  }

  return recurring.sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
}
