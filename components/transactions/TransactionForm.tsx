'use client';

import { useEffect } from 'react';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useFinanceStore } from '@/lib/store';
import { CATEGORIES } from '@/lib/constants';
import type { Transaction } from '@/types/finance';

const schema = z.object({
  description: z.string().min(1, 'Description is required'),
  amount: z.coerce.number().positive('Amount must be positive'),
  type: z.enum(['income', 'expense']),
  category: z.enum([
    'Food', 'Transport', 'Housing', 'Entertainment',
    'Health', 'Shopping', 'Income', 'Other',
  ]),
  date: z.string().min(1, 'Date is required'),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: Transaction | null;
}

export function TransactionForm({ open, onClose, editing }: Props) {
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const updateTransaction = useFinanceStore((s) => s.updateTransaction);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      type: 'expense',
      category: 'Food',
    },
  });

  const type = useWatch({ control, name: 'type' });
  const category = useWatch({ control, name: 'category' });

  useEffect(() => {
    if (editing) {
      reset({
        description: editing.description,
        amount: editing.amount,
        type: editing.type,
        category: editing.category,
        date: editing.date,
      });
    } else {
      reset({
        date: new Date().toISOString().slice(0, 10),
        type: 'expense',
        category: 'Food',
        description: '',
        amount: 0,
      });
    }
  }, [editing, reset, open]);

  const onSubmit = (data: FormData) => {
    if (editing) {
      updateTransaction(editing.id, data);
    } else {
      addTransaction(data);
    }
    onClose();
  };

  const filteredCategories = type === 'income'
    ? CATEGORIES.filter((c) => c === 'Income' || c === 'Other')
    : CATEGORIES.filter((c) => c !== 'Income');

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Transaction' : 'Add Transaction'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="description">Description</Label>
            <Input id="description" placeholder="e.g. Grocery run" {...register('description')} />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="amount">Amount ($)</Label>
              <Input id="amount" type="number" step="0.01" min="0" placeholder="0.00" {...register('amount')} />
              {errors.amount && (
                <p className="text-xs text-destructive">{errors.amount.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setValue('type', v as 'income' | 'expense')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Category</Label>
              <Select
                value={category}
                onValueChange={(v) => setValue('category', v as FormData['category'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {filteredCategories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" {...register('date')} />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">{editing ? 'Save Changes' : 'Add Transaction'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
