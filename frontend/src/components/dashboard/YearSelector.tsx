import { parseISO } from 'date-fns';
import { IncomeEntry, Transaction } from '../../types';

interface YearSelectorProps {
  transactions: Transaction[];
  incomeEntries?: IncomeEntry[];
  value: number;
  onChange: (year: number) => void;
}

// Renders a <select> of years derived from the data, descending. Pulls
// from transactions (skipping archived) plus income entries if provided.
// Always includes the current year even if there's no data for it.
export default function YearSelector({ transactions, incomeEntries, value, onChange }: YearSelectorProps) {
  const currentYear = new Date().getFullYear();
  const fromData = new Set<number>();
  for (const t of transactions) {
    if (t.archived) continue;
    fromData.add(parseISO(t.date).getFullYear());
  }
  if (incomeEntries) {
    for (const e of incomeEntries) {
      fromData.add(parseISO(e.date).getFullYear());
    }
  }
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
