'use client';

import { Badge } from '@/components/ui/badge';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function SyncMeta({
  updatedAt,
  badges,
}: {
  updatedAt: string | null;
  badges?: string[];
}) {
  if (!updatedAt && (!badges || badges.length === 0)) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1">
      {updatedAt && (
        <span className="text-[11px] text-muted-foreground">
          Synced {timeAgo(updatedAt)}
        </span>
      )}
      {badges?.map((b) => (
        <Badge key={b} variant="secondary" className="text-[10px]">
          {b}
        </Badge>
      ))}
    </div>
  );
}
