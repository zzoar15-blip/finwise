import Link from 'next/link';
import type { ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  backHref,
  backLabel = 'My Plan',
  actions,
}: {
  title: string;
  subtitle: string;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex min-h-[72px] items-center justify-between border-b border-[#e2e8f0] bg-white px-8 py-3">
      <div>
        {backHref ? (
          <Link href={backHref} className="text-xs text-[#64748b] hover:text-[#0f172a]">
            {`← ${backLabel}`}
          </Link>
        ) : null}
        <h1 className="text-[22px] font-bold text-[#0f172a]">{title}</h1>
        <p className="text-[13px] text-[#64748b]">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </header>
  );
}

