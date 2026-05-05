'use client';

import BonusAllocationSection from '@/components/bonus/BonusAllocationSection';
import { PageHeader } from '@/components/layout/PageHeader';

export default function BonusSettingsPage() {
  return (
    <div className="mx-auto max-w-[960px] space-y-8 px-6 py-8">
      <PageHeader
        title="Bonus allocation"
        subtitle="Configure how your annual bonus is split across goals — forecasts and calculators stay in sync."
      />
      <BonusAllocationSection />
    </div>
  );
}
