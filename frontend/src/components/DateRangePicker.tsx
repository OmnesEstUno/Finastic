import { useEffect, useState } from 'react';
import { parseISO } from 'date-fns';
import { CustomDateRange } from '../types';

interface DateRangePickerProps {
  value: CustomDateRange | null;
  onChange: (range: CustomDateRange) => void;
  minDate?: string; // yyyy-mm-dd; earliest selectable date (passed to <input min>)
  maxDate?: string; // yyyy-mm-dd; latest selectable date (passed to <input max>)
}

// Two date inputs + Apply. The browser's native date picker enforces the
// min/max bounds (greys out dates outside the range), so apply-time checks
// only need to guard start < end and non-empty values.
export default function DateRangePicker({ value, onChange, minDate, maxDate }: DateRangePickerProps) {
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
    if (parseISO(start) > parseISO(end)) { setError('Start must be before end.'); return; }
    if (minDate && start < minDate) { setError('Start is before the earliest data.'); return; }
    if (maxDate && end > maxDate) { setError('End cannot be in the future.'); return; }
    setError('');
    onChange({ start, end });
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <input
        type="date"
        className="input"
        style={{ padding: '4px 8px', width: 150 }}
        min={minDate}
        max={maxDate}
        value={start}
        onChange={(e) => setStart(e.target.value)}
      />
      <span style={{ color: 'var(--text-muted)' }}>→</span>
      <input
        type="date"
        className="input"
        style={{ padding: '4px 8px', width: 150 }}
        min={minDate}
        max={maxDate}
        value={end}
        onChange={(e) => setEnd(e.target.value)}
      />
      <button type="button" className="btn btn-sm btn-primary" onClick={apply}>Apply</button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
