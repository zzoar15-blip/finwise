export interface NetWorthItem {
  id: string;
  name: string;
  amount: number;
  category: string;
}

export interface NetWorthSnapshot {
  date: string; // yyyy-mm
  assets: number;
  liabilities: number;
  netWorth: number;
}

export function sumNetWorth(items: NetWorthItem[]): number {
  return items.reduce((s, i) => s + Math.max(0, i.amount), 0);
}

export function computeNetWorthTotals(
  assets: NetWorthItem[],
  liabilities: NetWorthItem[],
): { assets: number; liabilities: number; netWorth: number } {
  const totalAssets = sumNetWorth(assets);
  const totalLiabilities = sumNetWorth(liabilities);
  return {
    assets: totalAssets,
    liabilities: totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
  };
}

export function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
