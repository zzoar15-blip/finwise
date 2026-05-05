'use client';

import { useState } from 'react';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useFinanceStore } from '@/lib/store';
import { formatCurrency, formatDate } from '@/lib/format';
import { CATEGORY_ICONS } from '@/lib/constants';
import type { Transaction } from '@/types/finance';

interface Props {
  transaction: Transaction;
  onEdit: (t: Transaction) => void;
}

export function TransactionRow({ transaction: t, onEdit }: Props) {
  const deleteTransaction = useFinanceStore((s) => s.deleteTransaction);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <TableRow>
        <TableCell className="text-muted-foreground text-sm">{formatDate(t.date)}</TableCell>
        <TableCell>
          <div className="font-medium">{t.description}</div>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="gap-1">
            <span>{CATEGORY_ICONS[t.category]}</span>
            {t.category}
          </Badge>
        </TableCell>
        <TableCell className={`text-right font-semibold ${t.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
          {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
        </TableCell>
        <TableCell className="w-10">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-muted transition-colors">
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(t)}>
                <Pencil className="mr-2 h-4 w-4" />Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{t.description}&rdquo; will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTransaction(t.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
