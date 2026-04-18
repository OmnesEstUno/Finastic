// Shared constants for the Dashboard page and its extracted sub-components.

export const SURPLUS_COLOR = '#7dd3fc'; // muted sky blue
export const DEFICIT_COLOR = '#a78bfa'; // muted violet
export const INCOME_COLOR = '#4ade80';
export const EXPENSE_COLOR = '#f87171';

export type DrillDownRange = 'year' | 'last12' | 'last3' | 'all';

export const DRILL_DOWN_RANGE_LABELS: Record<DrillDownRange, string> = {
  year: 'This year',
  last12: 'Last 12 months',
  last3: 'Last 3 months',
  all: 'All time',
};

// Shared formatter for chart tick labels that must handle negatives.
// "-$1.5k", "$500", etc.
export function formatAxisCurrency(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  const short = abs >= 1000 ? `${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k` : String(abs);
  return `${sign}$${short}`;
}
