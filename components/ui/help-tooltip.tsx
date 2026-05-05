'use client';

import { Info } from 'lucide-react';

export function HelpTooltip({ title, body }: { title: string; body: string }) {
  return (
    <span className="group relative inline-flex items-center">
      <Info className="size-3.5 text-[#94a3b8]" />
      <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-[280px] -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-xl group-hover:block">
        <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-l border-t border-slate-200 bg-white" />
        <p className="text-[13px] font-semibold text-slate-800">{title}</p>
        <p className="mt-1 text-[12px] leading-[1.5] text-[#64748b]">{body}</p>
      </span>
    </span>
  );
}

