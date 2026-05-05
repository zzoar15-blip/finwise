'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Calculator, PieChart, CreditCard,
  TrendingUp, BarChart3, Wallet, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/advisor', label: 'AI Advisor', icon: Sparkles },
  { href: '/paycheck', label: 'Paycheck', icon: Calculator },
  { href: '/budget', label: 'Budget', icon: PieChart },
  { href: '/debt', label: 'Debt Payoff', icon: CreditCard },
  { href: '/invest', label: 'Investments', icon: TrendingUp },
  { href: '/forecast', label: 'Forecaster', icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex flex-col w-60 min-h-screen bg-[#1a2744] text-white px-3 py-6 gap-0.5 shrink-0">
      <div className="flex items-center gap-2.5 px-3 mb-8">
        <div className="h-8 w-8 rounded-lg bg-[#1a56a8] flex items-center justify-center">
          <Wallet className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight">FinWise</span>
      </div>

      <p className="px-3 text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Tools</p>

      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'bg-[#1a56a8] text-white'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </aside>
  );
}
