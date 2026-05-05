'use client';

import { useEffect } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
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
import { useFinanceStore } from '@/lib/store';
import { CATEGORY_ICONS } from '@/lib/constants';
import type { Category } from '@/types/finance';

const schema = z.object({
  limit: z.coerce.number().min(0, 'Must be 0 or more'),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  category: Category;
  currentLimit: number;
}

export function BudgetForm({ open, onClose, category, currentLimit }: Props) {
  const setBudget = useFinanceStore((s) => s.setBudget);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: { limit: currentLimit },
  });

  useEffect(() => {
    reset({ limit: currentLimit });
  }, [currentLimit, reset, open]);

  const onSubmit = (data: FormData) => {
    setBudget(category, data.limit);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {CATEGORY_ICONS[category]} Set Budget — {category}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="limit">Monthly limit ($)</Label>
            <Input
              id="limit"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              {...register('limit')}
            />
            {errors.limit && (
              <p className="text-xs text-destructive">{errors.limit.message}</p>
            )}
            <p className="text-xs text-muted-foreground">Set to 0 to remove the limit.</p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">Save Budget</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
