import { useEffect, useState } from 'react';
import { parseISO } from 'date-fns';
import { CustomDateRange } from '../types';

interface DateRangePickerProps {
  value: CustomDateRange | null;
  onChange: (range: CustomDateRange) => void;
  maxSpanYears?: number;
}

// Two date inputs + Apply, with a configurable max span (default 10 years).
export default function DateRangePicker({ value, onChange, maxSpanYears = 10 }: DateRangePickerProps) {
  const [start, setStart] = useState(value?.start ?? '');
  const [end, setEnd] = useState(value?.end ?? '');
  const [error, setError] = useState('');

  // Keep the local draft in sync if the parent resets the value (e.g., after
  // a workspace switch clears the custom range).
  useEffect(() => {
    setStart(value?.start ?? '');
    setEnd(value?.end ?? '');
  }, [value?.start, value?.end]);

  function apply() {
    if (!start || !end) { setError('Both dates required.'); return; }
    const startDate = parseISO(start);
    const endDate = parseISO(end);
    if (startDate > endDate) { setError('Start must be before end.'); return; }
    const spanYears = (endDate.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (spanYears > maxSpanYears) { setError(`Range exceeds ${maxSpanYears}-year limit.`); return; }
    setError('');
    onChange({ start, end });
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <input
        type="date"
        className="input"
        style={{ padding: '4px 8px', width: 150 }}
        value={start}
        onChange={(e) => setStart(e.target.value)}
      />
      <span style={{ color: 'var(--text-muted)' }}>→</span>
      <input
        type="date"
        className="input"
        style={{ padding: '4px 8px', width: 150 }}
        value={end}
        onChange={(e) => setEnd(e.target.value)}
      />
      <button type="button" className="btn btn-sm btn-primary" onClick={apply}>Apply</button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
