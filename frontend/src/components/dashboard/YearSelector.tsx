import { parseISO } from 'date-fns';
import { Transaction } from '../../types';

interface YearSelectorProps {
  transactions: Transaction[];
  value: number;
  onChange: (year: number) => void;
}

// Renders a <select> of years derived from the transaction data, descending.
// Always includes the current year even if there's no data for it.
export default function YearSelector({ transactions, value, onChange }: YearSelectorProps) {
  const currentYear = new Date().getFullYear();
  const fromData = new Set(
    transactions.filter((t) => !t.archived).map((t) => parseISO(t.date).getFullYear()),
  );
  fromData.add(currentYear);
  const years = [...fromData].sort((a, b) => b - a);
  return (
    <select
      className="select"
      style={{ width: 'auto', padding: '5px 10px', fontSize: '0.8125rem' }}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {years.map((y) => (
        <option key={y} value={y}>{y}</option>
      ))}
    </select>
  );
}
