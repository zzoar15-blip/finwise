'use client';

import { usePathname } from 'next/navigation';
import { usePlanStore } from '@/lib/planStore';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/plan': 'My Plan',
  '/paycheck': 'Paycheck Calculator',
  '/budget': 'Budget Planner',
  '/debt': 'Debt Simulator',
  '/invest': 'Investment Simulator',
  '/forecast': 'Scenario Forecaster',
  '/advisor': 'AI Advisor',
  '/settings': 'Settings',
};

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
  const pathname = usePathname();
  const { settings } = usePlanStore();

  const title =
    Object.entries(PAGE_TITLES).find(([path]) =>
      path === '/' ? pathname === '/' : pathname.startsWith(path)
    )?.[1] ?? 'FinWise';

  const initials = getInitials(settings.displayName);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-white px-6">
      <h1 className="text-base font-semibold text-[#0f172a]">{title}</h1>
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1e3a5f] text-xs font-semibold text-white select-none">
          {initials}
        </div>
      </div>
    </header>
  );
}
