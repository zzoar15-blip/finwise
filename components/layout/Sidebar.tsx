'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Calculator, PieChart, CreditCard,
  TrendingUp, BarChart3, Sparkles, FileText, Settings,
  LineChart, Home,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const PRIMARY_NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/plan', label: 'My Plan', icon: FileText },
];

const TOOLS_NAV = [
  { href: '/paycheck', label: 'Paycheck Calculator', icon: Calculator },
  { href: '/budget', label: 'Budget Planner', icon: PieChart },
  { href: '/debt', label: 'Debt Simulator', icon: CreditCard },
  { href: '/invest', label: 'Investment Simulator', icon: TrendingUp },
  { href: '/forecast', label: 'Scenario Forecaster', icon: BarChart3 },
  { href: '/tools/rent-vs-buy', label: 'Rent vs. Buy', icon: Home },
];

function NavItem({
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
        'group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors relative',
        indent ? 'ml-2' : '',
        active
          ? 'bg-[#1e3a5f] text-white before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:rounded-r before:bg-[#3b82f6]'
          : 'text-white/60 hover:bg-[#1e3a5f]/60 hover:text-white'
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex flex-col w-60 min-h-screen bg-[#0f172a] shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5 mb-1">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#3b82f6]">
          <LineChart className="h-4 w-4 text-white" />
        </div>
        <span className="text-[15px] font-bold tracking-tight text-white">FinWise</span>
      </div>

      <nav className="flex flex-col gap-0.5 px-3 flex-1">
        {/* Primary */}
        {PRIMARY_NAV.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}

        {/* Divider */}
        <div className="my-3 border-t border-white/10" />

        {/* Tools section */}
        <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/30">
          Tools
        </p>
        {TOOLS_NAV.map((item) => (
          <NavItem key={item.href} {...item} indent />
        ))}

        <div className="flex-1" />

        {/* Divider */}
        <div className="my-3 border-t border-white/10" />

        {/* Bottom */}
        <NavItem href="/advisor" label="AI Advisor" icon={Sparkles} />
        <NavItem href="/settings" label="Settings" icon={Settings} />
        <div className="h-4" />
      </nav>
    </aside>
  );
}
