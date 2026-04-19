import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '../../utils/dataProcessing';
import {
  INCOME_COLOR, EXPENSE_COLOR, formatAxisCurrency,
} from './constants';

interface MonthlyBalanceViewProps {
  monthlyBalance: Array<{
    month: string;
    monthIndex: number;
    income: number;
    expenses: number;
    surplus: number;
  }>;
  onMonthClick: (monthIndex: number) => void;
}

function MonthlyBalanceView({ monthlyBalance, onMonthClick }: MonthlyBalanceViewProps) {
  return (
    <>
      {/* Numeric table — rows are clickable */}
      <div className="table-wrapper" style={{ marginBottom: 24 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Month</th>
              <th className="num">Income</th>
              <th className="num">Expenses</th>
              <th className="num">Surplus / Deficit</th>
            </tr>
          </thead>
          <tbody>
            {monthlyBalance.map((row) => (
              <tr
                key={row.month}
                onClick={() => onMonthClick(row.monthIndex)}
                style={{ cursor: 'pointer' }}
                title="Click to drill down into this month"
              >
                <td>{row.month}</td>
                <td className="num text-success">{row.income > 0 ? formatCurrency(row.income) : <span className="zero">—</span>}</td>
                <td className="num text-danger">{row.expenses > 0 ? formatCurrency(row.expenses) : <span className="zero">—</span>}</td>
                <td className={`num ${row.surplus >= 0 ? 'text-success' : 'text-danger'}`}>
                  {(row.income > 0 || row.expenses > 0) ? formatCurrency(row.surplus) : <span className="zero">—</span>}
                </td>
              </tr>
            ))}
            {/* YTD totals */}
            <tr style={{ background: 'var(--bg-elevated)', fontWeight: 600 }}>
              <td>YTD Total</td>
              <td className="num text-success">
                {formatCurrency(monthlyBalance.reduce((s, r) => s + r.income, 0))}
              </td>
              <td className="num text-danger">
                {formatCurrency(monthlyBalance.reduce((s, r) => s + r.expenses, 0))}
              </td>
              <td className={`num ${monthlyBalance.reduce((s, r) => s + r.surplus, 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                {formatCurrency(monthlyBalance.reduce((s, r) => s + r.surplus, 0))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Bar chart — click any column to drill down */}
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={monthlyBalance}
          margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
          onClick={(state: unknown) => {
            const s = state as { activePayload?: Array<{ payload?: { monthIndex?: number } }> } | null;
            const idx = s?.activePayload?.[0]?.payload?.monthIndex;
            if (typeof idx === 'number') onMonthClick(idx);
          }}
          style={{ cursor: 'pointer' }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={formatAxisCurrency}
          />
          <Tooltip
            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.8125rem' }}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            formatter={(value: number, name: string) => [formatCurrency(value), name]}
          />
          <Legend
            wrapperStyle={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}
            payload={[
              { value: 'Income', type: 'square', color: INCOME_COLOR, id: 'income' },
              { value: 'Expenses', type: 'square', color: EXPENSE_COLOR, id: 'expenses' },
            ]}
          />
          <Bar dataKey="income" name="Income" fill={INCOME_COLOR} radius={[3, 3, 0, 0]} />
          <Bar dataKey="expenses" name="Expenses" fill={EXPENSE_COLOR} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}

export default MonthlyBalanceView;
