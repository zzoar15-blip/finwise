'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Calculator, PieChart, CreditCard,
  TrendingUp, BarChart3, Sparkles, FileText, Settings,
  LineChart, Home, PiggyBank, Wallet, HousePlus, CarFront,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const PRIMARY_NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/plan', label: 'My Plan', icon: FileText },
];

const TOOL_GROUPS = [
  {
    label: 'INCOME',
    items: [{ href: '/paycheck', label: 'Paycheck Calculator', icon: Calculator }],
  },
  {
    label: 'PLANNING',
    items: [
      { href: '/budget', label: 'Budget Planner', icon: PieChart },
      { href: '/forecast', label: 'Scenario Forecaster', icon: BarChart3 },
      { href: '/tools/net-worth', label: 'Net Worth', icon: Wallet },
      { href: '/tools/sinking-fund', label: 'Sinking Fund', icon: PiggyBank },
    ],
  },
  {
    label: 'DEBT',
    items: [{ href: '/debt', label: 'Debt Simulator', icon: CreditCard }],
  },
  {
    label: 'INVESTING',
    items: [{ href: '/invest', label: 'Investment Simulator', icon: TrendingUp }],
  },
  {
    label: 'HOUSING',
    items: [
      { href: '/tools/rent-vs-buy', label: 'Rent vs. Buy', icon: Home },
      { href: '/tools/housing-affordability', label: 'Affordability', icon: HousePlus },
      { href: '/tools/car-affordability', label: 'Car Affordability', icon: CarFront },
    ],
  },
] as const;

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
        indent ? 'pl-1' : '',
        active
          ? 'bg-[#1c2f4d] text-white before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:rounded-r before:bg-[#60a5fa]'
          : 'text-white/70 hover:bg-[#17253e] hover:text-white'
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex flex-col w-64 min-h-screen bg-gradient-to-b from-[#0a1424] via-[#101d33] to-[#172a45] shrink-0 border-r border-white/10">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5 mb-1">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2563eb]">
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

        {TOOL_GROUPS.map((group) => (
          <div key={group.label} className="mb-1">
            <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
              {group.label}
            </p>
            {group.items.map((item) => (
              <NavItem key={item.href} {...item} indent />
            ))}
          </div>
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
