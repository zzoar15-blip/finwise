'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ExportButtonProps {
  onExportXlsx: () => void;
  onExportCsv: () => void;
  label?: string;
}

export function ExportButton({ onExportXlsx, onExportCsv, label = 'Export' }: ExportButtonProps) {
  const [done, setDone] = useState<'xlsx' | 'csv' | null>(null);

  function flash(type: 'xlsx' | 'csv', fn: () => void) {
    fn();
    setDone(type);
    setTimeout(() => setDone(null), 1800);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors">
        <Download className="h-3.5 w-3.5" />
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => flash('xlsx', onExportXlsx)} className="gap-2 cursor-pointer">
          {done === 'xlsx' ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <FileSpreadsheet className="h-4 w-4 text-green-700" />
          )}
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => flash('csv', onExportCsv)} className="gap-2 cursor-pointer">
          {done === 'csv' ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <FileText className="h-4 w-4 text-blue-600" />
          )}
          CSV / Google Sheets
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
