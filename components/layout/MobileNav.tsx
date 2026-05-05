'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FileText, Calculator, CreditCard, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const MOBILE_NAV = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/plan', label: 'My Plan', icon: FileText },
  { href: '/paycheck', label: 'Paycheck', icon: Calculator },
  { href: '/debt', label: 'Debt', icon: CreditCard },
  { href: '/advisor', label: 'Advisor', icon: Sparkles },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#1a2744] z-50">
      <div className="flex overflow-x-auto no-scrollbar">
        {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-1 min-w-0 flex-col items-center gap-0.5 py-2 px-1 text-[10px] font-medium transition-colors shrink-0',
                active ? 'text-white' : 'text-white/50'
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
