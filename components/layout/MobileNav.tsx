'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FileText, Calculator, CreditCard, Sparkles,
  Home, PiggyBank, Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const MOBILE_NAV = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/plan', label: 'My Plan', icon: FileText },
  { href: '/paycheck', label: 'Paycheck', icon: Calculator },
  { href: '/debt', label: 'Debt', icon: CreditCard },
  { href: '/tools/net-worth', label: 'Net Worth', icon: Wallet },
  { href: '/tools/rent-vs-buy', label: 'Rent/Buy', icon: Home },
  { href: '/tools/sinking-fund', label: 'Fund', icon: PiggyBank },
  { href: '/advisor', label: 'Advisor', icon: Sparkles },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-[#2a5b6a] bg-gradient-to-r from-[#0e2a43] via-[#12435e] to-[#1a5f56]">
      <div className="flex overflow-x-auto no-scrollbar">
        {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-1 min-w-0 flex-col items-center gap-0.5 py-2 px-1 text-[10px] font-medium transition-colors shrink-0',
                active ? 'text-white' : 'text-white/65'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="truncate w-full text-center">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
