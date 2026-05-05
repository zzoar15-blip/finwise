'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, FileText, Sparkles, Settings, Grid2x2, X,
  Calculator, PieChart, CreditCard, TrendingUp, BarChart3, Wallet, PiggyBank, Home, HousePlus, CarFront,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const MOBILE_NAV = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/plan', label: 'Plan', icon: FileText },
  { href: '#tools', label: 'Tools', icon: Grid2x2, toolsTrigger: true },
  { href: '/advisor', label: 'Advisor', icon: Sparkles },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const TOOL_LINKS = [
  { href: '/paycheck', label: 'Paycheck Calculator', icon: Calculator },
  { href: '/budget', label: 'Budget Planner', icon: PieChart },
  { href: '/debt', label: 'Debt Simulator', icon: CreditCard },
  { href: '/invest', label: 'Investment Simulator', icon: TrendingUp },
  { href: '/forecast', label: 'Scenario Forecaster', icon: BarChart3 },
  { href: '/tools/net-worth', label: 'Net Worth', icon: Wallet },
  { href: '/tools/sinking-fund', label: 'Sinking Fund', icon: PiggyBank },
  { href: '/tools/rent-vs-buy', label: 'Rent vs. Buy', icon: Home },
  { href: '/tools/housing-affordability', label: 'Housing Affordability', icon: HousePlus },
  { href: '/tools/car-affordability', label: 'Car Affordability', icon: CarFront },
];

export function MobileNav() {
  const pathname = usePathname();
  const [toolsOpen, setToolsOpen] = useState(false);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#1a2a44] bg-gradient-to-r from-[#0b1628] via-[#0f1e35] to-[#132544] md:hidden">
        <div className="grid h-16 grid-cols-5">
          {MOBILE_NAV.map(({ href, label, icon: Icon, toolsTrigger }) => {
            const active = toolsTrigger
              ? pathname.startsWith('/paycheck') || pathname.startsWith('/budget') || pathname.startsWith('/debt') || pathname.startsWith('/invest') || pathname.startsWith('/forecast') || pathname.startsWith('/tools')
              : href === '/' ? pathname === '/' : pathname.startsWith(href);
            if (toolsTrigger) {
              return (
                <button
                  key={label}
                  onClick={() => setToolsOpen(true)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors',
                    active ? 'text-[#93c5fd]' : 'text-white/70',
                  )}
                >
                  <Icon className="h-6 w-6" />
                  <span>{label}</span>
                </button>
              );
            }
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors',
                  active ? 'text-[#93c5fd]' : 'text-white/70'
                )}
              >
                <Icon className="h-6 w-6" />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {toolsOpen && (
        <div className="fixed inset-0 z-[60] bg-black/40 md:hidden" onClick={() => setToolsOpen(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 max-h-[78vh] rounded-t-2xl border border-slate-200 bg-white p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">All Tools</p>
              <button onClick={() => setToolsOpen(false)} className="rounded-md p-1 text-slate-600 hover:bg-slate-100">
                <X className="size-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-1 overflow-y-auto pb-20">
              {TOOL_LINKS.map(({ href, label, icon: ToolIcon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setToolsOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <ToolIcon className="size-5 text-slate-600" />
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
