export function formatCurrency(n: number, showCents = false): string {
  if (n === 0) return '$0';
  if (Math.abs(n) >= 1000000) {
    return '$' + (n / 1000000).toFixed(1) + 'M';
  }
  if (showCents) {
    return '$' + n.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return '$' + Math.round(n).toLocaleString('en-US');
}

export const formatDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

export const formatMonth = (yearMonth: string) => {
  const [year, month] = yearMonth.split('-');
  return new Date(Number(year), Number(month) - 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
};

export function getMonthOptions(count = 12): { value: string; label: string }[] {
  const options = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    options.push({ value, label });
  }
  return options;
}
