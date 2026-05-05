import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

interface EmptyChartProps {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  height?: number;
}

export function EmptyChart({
  icon: Icon,
  title,
  description,
  ctaLabel,
  ctaHref,
  height = 280,
}: EmptyChartProps) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#e2e8f0] bg-[#f8fafc] px-6 text-center"
      style={{ height }}
    >
      <Icon className="size-10 text-[#94a3b8]" />
      <p className="mt-3 text-[15px] font-bold text-[#64748b]">{title}</p>
      <p className="mt-1 text-[13px] text-[#94a3b8]">{description}</p>
      {ctaLabel && ctaHref ? (
        <Link
          href={ctaHref}
          className="mt-4 inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
        >
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}

