import { useLayoutEffect, useRef, useState } from 'react';
import { TimeRange } from '../../types';

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  week: 'Past Week',
  month: 'Past Month',
  '3month': 'Past 3 Months',
  year: 'Past 1 Year',
  custom: 'Custom Range',
};

// .select left padding (12) + right padding (32 — chevron) + 2*1 border + small buffer.
// Native <select> sizes to its widest <option>; we override to size to the
// CURRENT label by measuring it offscreen and applying width inline.
const SELECT_HORIZONTAL_CHROME_PX = 48;

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

export default function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  const measureRef = useRef<HTMLSpanElement>(null);
  const [textWidth, setTextWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (measureRef.current) {
      setTextWidth(measureRef.current.offsetWidth);
    }
  }, [value]);

  return (
    <>
      <span
        ref={measureRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: -9999,
          top: -9999,
          visibility: 'hidden',
          whiteSpace: 'nowrap',
          fontSize: '0.875rem',
          fontWeight: 400,
          pointerEvents: 'none',
        }}
      >
        {TIME_RANGE_LABELS[value]}
      </span>
      <select
        className="select"
        value={value}
        onChange={(e) => onChange(e.target.value as TimeRange)}
        aria-label="Time range"
        style={{
          width: textWidth != null ? textWidth + SELECT_HORIZONTAL_CHROME_PX : 'auto',
          flexShrink: 0,
        }}
      >
        {(Object.keys(TIME_RANGE_LABELS) as TimeRange[]).map((r) => (
          <option key={r} value={r}>{TIME_RANGE_LABELS[r]}</option>
        ))}
      </select>
    </>
  );
}
