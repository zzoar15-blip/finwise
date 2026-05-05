'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Calculator, PieChart, CreditCard,
  TrendingUp, BarChart3, Wallet, Sparkles, FileText,
  Settings, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const PRIMARY_NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/plan', label: 'My Plan', icon: FileText },
];

const TOOLS_NAV = [
  { href: '/paycheck', label: 'Paycheck', icon: Calculator },
  { href: '/budget', label: 'Budget Planner', icon: PieChart },
  { href: '/debt', label: 'Debt Simulator', icon: CreditCard },
  { href: '/invest', label: 'Investments', icon: TrendingUp },
  { href: '/forecast', label: 'Forecaster', icon: BarChart3 },
];

const BOTTOM_NAV = [
  { href: '/advisor', label: 'AI Advisor', icon: Sparkles },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function NavLink({
  href,
  label,
  icon: Icon,
  indent = false,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  indent?: boolean;
}) {
  const pathname = usePathname();
  const active = href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        indent ? 'pl-6' : '',
        active
          ? 'bg-[#1a56a8] text-white'
          : 'text-white/70 hover:bg-white/10 hover:text-white'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex flex-col w-60 min-h-screen bg-[#1a2744] text-white px-3 py-6 gap-0.5 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 mb-6">
        <div className="h-8 w-8 rounded-lg bg-[#1a56a8] flex items-center justify-center">
          <Wallet className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight">FinWise</span>
      </div>

      {/* Primary nav */}
      {PRIMARY_NAV.map((item) => (
        <NavLink key={item.href} {...item} />
      ))}

      <div className="mx-3 my-3 border-t border-white/10" />

      {/* Tools section */}
      <div className="flex items-center gap-1.5 px-3 mb-1">
        <p className="text-xs font-semibold text-white/40 uppercase tracking-widest">Tools</p>
        <ChevronRight className="h-3 w-3 text-white/30" />
      </div>
      {TOOLS_NAV.map((item) => (
        <NavLink key={item.href} {...item} indent />
      ))}

      {/* Push bottom nav to bottom */}
      <div className="flex-1" />

      <div className="mx-3 mb-2 border-t border-white/10" />

      {/* Bottom nav */}
      {BOTTOM_NAV.map((item) => (
        <NavLink key={item.href} {...item} />
      ))}
    </aside>
  );
}
