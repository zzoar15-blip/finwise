import { ChartSkeleton, MetricCardSkeleton, Skeleton } from '@/components/ui/skeleton';

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <MetricCardSkeleton />
      <ChartSkeleton height={320} />
      <ChartSkeleton height={320} />
    </div>
  );
}

