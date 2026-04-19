import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts';
import { Category, TimeRange } from '../../types';
import { getCategoryColor } from '../../utils/categories';
import { buildLineChartData, formatCurrency, getMaxValue, getTrendingCategories } from '../../utils/dataProcessing';
import { Transaction } from '../../types';
import CheckmarkToggle from '../CheckmarkToggle';

interface Props {
  transactions: Transaction[];
  timeRange: TimeRange;
}

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  week: 'Past Week',
  month: 'Past Month',
  '3month': 'Past 3 Months',
  year: 'Past 1 Year',
  all: 'All Time',
};

function CustomTooltip({ active, payload, label, highlighted }: TooltipProps<number, string> & { highlighted: Category | null }) {
  if (!active || !payload || payload.length === 0) return null;

  const filtered = highlighted ? payload.filter((e) => e.name === highlighted) : payload;
  const sorted = [...filtered].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '12px 16px',
        fontSize: '0.8125rem',
        maxWidth: 260,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ color: 'var(--text-muted)', marginBottom: 8, fontWeight: 500 }}>{label}</div>
      {sorted.map((entry) => (
        <div
          key={entry.name}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 24,
            color: entry.color,
            marginBottom: 4,
          }}
        >
          <span>{entry.name}</span>
          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
            {formatCurrency(entry.value ?? 0)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function CategoryLineChart({ transactions, timeRange }: Props) {
  // Derive the full category list from the current transactions so custom
  // categories appear automatically alongside built-ins.
  const allCategories = useMemo(() => getTrendingCategories(transactions), [transactions]);
  const [activeCategories, setActiveCategories] = useState<Set<Category>>(() => new Set(allCategories));
  const [hoveredLine, setHoveredLine] = useState<Category | null>(null);
  const [selectedLine, setSelectedLine] = useState<Category | null>(null);

  // When the set of available categories changes (e.g., after a new upload),
  // re-sync the active set to include everything. User toggles within the
  // same data reset here — they persist while the data is stable.
  useEffect(() => {
    setActiveCategories(new Set(allCategories));
  }, [allCategories]);

  // effective highlight: selection wins, otherwise hover
  const highlighted = selectedLine ?? hoveredLine;

  const data = buildLineChartData(transactions, timeRange);
  const maxValue = getMaxValue(data, activeCategories);

  const toggle = useCallback((cat: Category) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        if (next.size === 1) return prev;
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }, []);

  const selectCategory = useCallback((cat: Category) => {
    setSelectedLine((curr) => (curr === cat ? null : cat));
  }, []);

  const visibleCategories = allCategories.filter((c) =>
    data.some((point) => (point[c] as number | undefined) !== undefined && (point[c] as number) > 0),
  );

  if (data.length === 0) {
    return (
      <div
        style={{
          height: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
        }}
      >
        No expense data for this time period.
      </div>
    );
  }

  return (
    <div>
      {/* Legend with CheckmarkToggle chips */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px 12px',
          marginBottom: 12,
          alignItems: 'center',
        }}
      >
        {visibleCategories.map((cat) => {
          const isActive = activeCategories.has(cat);
          return (
            <div
              key={cat}
              style={{ opacity: highlighted && highlighted !== cat ? 0.4 : 1, transition: 'opacity 0.15s' }}
            >
              <CheckmarkToggle
                label={cat}
                color={getCategoryColor(cat)}
                active={isActive}
                size="sm"
                onToggle={() => toggle(cat)}
                onHover={() => setHoveredLine(cat)}
                onLeave={() => setHoveredLine(null)}
              />
            </div>
          );
        })}
        {selectedLine && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: '0.75rem' }}
            onClick={() => setSelectedLine(null)}
          >
            Clear selection
          </button>
        )}
      </div>
      <p className="text-xs text-muted" style={{ marginBottom: 16 }}>
        Tip: Click a chip to show/hide a category. Click a data point to isolate a line.
      </p>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart
          data={data}
          margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
          onClick={(e: unknown) => {
            // Click on empty chart area clears selection
            const ev = e as { activePayload?: unknown } | null;
            if (!ev || !ev.activePayload) setSelectedLine(null);
          }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
            label={{ value: 'Time Period', position: 'insideBottom', offset: -4, fill: 'var(--text-muted)', fontSize: 11 }}
          />
          <YAxis
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
            domain={[0, Math.ceil((maxValue * 1.1) / 50) * 50 || 100]}
            label={{
              value: 'Amount ($)',
              angle: -90,
              position: 'insideLeft',
              offset: 12,
              fill: 'var(--text-muted)',
              fontSize: 11,
            }}
          />
          <Tooltip content={<CustomTooltip highlighted={highlighted} />} />
          {allCategories.map((cat) => {
            if (!activeCategories.has(cat)) return null;
            const isHighlighted = highlighted === cat;
            const hasAnyHighlight = highlighted !== null;
            return (
              <Line
                key={cat}
                type="monotone"
                dataKey={cat}
                stroke={getCategoryColor(cat)}
                strokeWidth={isHighlighted ? 3 : 1.5}
                dot={false}
                activeDot={{
                  r: 5,
                  strokeWidth: 2,
                  stroke: getCategoryColor(cat),
                  fill: 'var(--bg-card)',
                  style: { cursor: 'pointer' },
                  onMouseEnter: () => setHoveredLine(cat),
                  onMouseLeave: () => setHoveredLine(null),
                  onClick: (e: { stopPropagation?: () => void }) => {
                    e?.stopPropagation?.();
                    selectCategory(cat);
                  },
                }}
                opacity={hasAnyHighlight && !isHighlighted ? 0.15 : 1}
                onMouseEnter={() => setHoveredLine(cat)}
                onMouseLeave={() => setHoveredLine(null)}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export { TIME_RANGE_LABELS };
export type { Props as CategoryLineChartProps };
