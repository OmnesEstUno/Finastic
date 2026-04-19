import { useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import { format, parseISO } from 'date-fns';
import { CustomDateRange } from '../types';
import 'react-datepicker/dist/react-datepicker.css';

interface DateRangePickerProps {
  value: CustomDateRange | null;
  onChange: (range: CustomDateRange) => void;
  minDate?: string; // yyyy-mm-dd
  maxDate?: string; // yyyy-mm-dd
}

const toISO = (d: Date) => format(d, 'yyyy-MM-dd');
const fromISO = (s: string | null | undefined) => (s ? parseISO(s) : null);

// react-datepicker with month + year dropdowns in the header.
// Clicking either dropdown opens a list; selecting a value updates the
// day grid and auto-returns to the day-selection view.
export default function DateRangePicker({ value, onChange, minDate, maxDate }: DateRangePickerProps) {
  const [start, setStart] = useState<string>(value?.start ?? '');
  const [end, setEnd] = useState<string>(value?.end ?? '');
  const [error, setError] = useState('');

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

  const min = fromISO(minDate);
  const max = fromISO(maxDate);

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <DatePicker
        selected={fromISO(start)}
        onChange={(d: Date | null) => setStart(d ? toISO(d) : '')}
        minDate={min ?? undefined}
        maxDate={max ?? undefined}
        dateFormat="yyyy-MM-dd"
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
        placeholderText="Start date"
        className="input"
        wrapperClassName="date-range-wrapper"
      />
      <span style={{ color: 'var(--text-muted)' }}>→</span>
      <DatePicker
        selected={fromISO(end)}
        onChange={(d: Date | null) => setEnd(d ? toISO(d) : '')}
        minDate={min ?? undefined}
        maxDate={max ?? undefined}
        dateFormat="yyyy-MM-dd"
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
        placeholderText="End date"
        className="input"
        wrapperClassName="date-range-wrapper"
      />
      <button type="button" className="btn btn-sm btn-primary" onClick={apply}>Apply</button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
