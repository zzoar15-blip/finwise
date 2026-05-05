import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  ctaHref,
}: EmptyStateProps) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <Icon className="mb-4 size-12 text-[#1e3a8a]" />
      <h3 className="text-[24px] font-bold text-[#0f172a]">{title}</h3>
      <p className="mt-2 max-w-md text-[14px] text-[#64748b]">{description}</p>
      <Link
        href={ctaHref}
        className="mt-5 inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}

