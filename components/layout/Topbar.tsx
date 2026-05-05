'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePlanStore } from '@/lib/planStore';
import { useFinWiseStore } from '@/lib/store';
import { ChevronDown, Info, RotateCcw, Settings } from 'lucide-react';

function getInitials(name: string): string {
  if (!name.trim()) return 'FW';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

export function Topbar() {
  const { settings, clearPlan } = usePlanStore();
  const setPaycheckInputs = useFinWiseStore((s) => s.setPaycheckInputs);
  const setBudgetInputs = useFinWiseStore((s) => s.setBudgetInputs);
  const setDebts = useFinWiseStore((s) => s.setDebts);
  const setGoals = useFinWiseStore((s) => s.setGoals);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const initials = getInitials(settings.displayName);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleResetData() {
    if (!window.confirm('Reset all plan and tool data? This cannot be undone.')) return;
    clearPlan();
    setPaycheckInputs({
      annualSalary: 0,
      k401TraditionalPct: 0,
      k401RothPct: 0,
      hsaAnnual: 0,
      fsaAnnual: 0,
      healthInsuranceAnnual: 0,
      dentalAnnual: 0,
      visionAnnual: 0,
      commuterAnnual: 0,
      otherPreTaxAnnual: 0,
      otherPostTaxAnnual: 0,
      additionalWithholding: 0,
    });
    setBudgetInputs({
      investmentIncome: 0,
      housing: 0,
      utilities: 0,
      insurance: 0,
      groceries: 0,
      dining: 0,
      transportation: 0,
      subscriptions: 0,
      phone: 0,
      healthGym: 0,
      travel: 0,
      misc: 0,
      brokerageMonthly: 0,
      rothIraMonthly: 0,
      emergencyFundMonthly: 0,
      homeDownPaymentMonthly: 0,
    });
    setDebts([]);
    setGoals([]);
    setMenuOpen(false);
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#dce5f1] bg-white/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div />
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded-full border border-[#cfe0fa] bg-[#eff5ff] px-2 py-1 text-xs font-semibold text-[#1d4ed8]"
          aria-label="Open profile menu"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-semibold text-[#1d4ed8]">
            {initials}
          </span>
          <ChevronDown className="size-3.5" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-11 z-50 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
            <Link
              href="/settings"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => setMenuOpen(false)}
            >
              <Settings className="size-4" />
              Settings
            </Link>
            <button
              onClick={handleResetData}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <RotateCcw className="size-4" />
              Reset data
            </button>
            <Link
              href="/advisor"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => setMenuOpen(false)}
            >
              <Info className="size-4" />
              About
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
