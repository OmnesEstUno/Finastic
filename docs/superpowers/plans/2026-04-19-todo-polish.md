# Dashboard Polish + Settings Extensions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 13 todo.txt items — dashboard card/chart polish, drill-down sortability, a floating Enter Data button, settings page additions (card visibility, feature requests), and minor UI tweaks.

**Architecture:** Two sequential feature branches. Branch A covers all dashboard-card/chart work (9 items). Branch B covers Settings + nav/layout + the narrow-tabs tweak (4 items). Both land on `main` through the existing merge flow; each task commits independently so smoke tests can bisect if anything regresses.

**Tech Stack:** React 18 + TypeScript strict, Vite, Recharts, date-fns, @dnd-kit, react-datepicker. No unit-test infrastructure in this repo — verification is `tsc`, `vite build`, and in-browser smoke-test per task.

---

## Branches

| Branch | Items | Theme |
|---|---|---|
| `feat/dashboard-polish` | 1, 2, 3, 4, 7, 8, 9, 11 | Dashboard cards, drill-down sortability, charts |
| `feat/settings-extensions` | 5, 6, 10, 12, 13 | Floating FAB, settings additions, nav tweaks |

Item 5 (FAB) lives in Layout which is shared, so it ships with Branch B alongside the other nav/layout changes.

---

## Cross-Cutting Decisions

**Task 8 interpretation (confirmed by user):** Each affected card gains a `DateRangePicker` the user can enable on demand. `YearSelector` learns a new "Custom…" option; picking it reveals a right-justified `DateRangePicker` below the card header and narrows data to that range. Picking a normal year clears the custom range. One active filter at a time per card.

**Expenses by Category in custom-range mode (confirmed by user):** Keep the same month-grid table. Each column header renders the month name with the 4-digit year *underneath* as a sub-label. Year-mode headers are unchanged (no year sub-label). The table rows' numeric cells stay one per column; the number of columns becomes dynamic based on the range span.

**Task 13 submission handling:** Feature requests post to a worker endpoint `/api/feature-requests`, stored in KV under `feature-requests:<iso-timestamp>:<short-id>` with `{ username, text, createdAt, status: 'new' }`. Admin users see them in a new InviteTokensCard-style list on the Settings page. Alternatives considered and rejected inline at Task 13.

**Pre-existing card IDs:** The dashboard-drag-minimize feature already defines `CARD_IDS` in `frontend/src/pages/Dashboard.tsx`. Task 10 reuses those IDs; no new enum needed.

---

# Branch A: `feat/dashboard-polish`

Base: `main` after the drag-minimize merge.

Create the branch:

```bash
git checkout main && git pull
git checkout -b feat/dashboard-polish
```

---

### Task A0: Extract `TimeRangeSelector` as a shared component (prep for Task 8)

**Why now:** Several tasks (2, 8) modify the custom-range control. Extracting first avoids churn.

**Files:**
- Create: `frontend/src/components/dashboard/TimeRangeSelector.tsx`
- Modify: `frontend/src/components/dashboard/YearSelector.tsx` — add a `customOption` prop that appends a `Custom…` value to the dropdown

- [ ] **Step 1: Create `TimeRangeSelector.tsx`**

Only used by Spending Trends for now; later (Task 8) wired into the other cards too.

```tsx
// frontend/src/components/dashboard/TimeRangeSelector.tsx
import { TimeRange } from '../../types';
import { TIME_RANGE_LABELS } from '../charts/CategoryLineChart';

interface Props {
  value: TimeRange;
  onChange: (r: TimeRange) => void;
}

export default function TimeRangeSelector({ value, onChange }: Props) {
  return (
    <div className="tabs">
      {(Object.keys(TIME_RANGE_LABELS) as TimeRange[]).map((r) => (
        <button
          key={r}
          className={`tab ${value === r ? 'active' : ''}`}
          onClick={() => onChange(r)}
        >
          {TIME_RANGE_LABELS[r]}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Swap the inline tabs in `Dashboard.tsx` for `<TimeRangeSelector />`**

In the `spending-trends` case of `renderCard()` (around the existing inline `<div className="tabs">…</div>`), replace with:

```tsx
headerActions={<TimeRangeSelector value={timeRange} onChange={setTimeRange} />}
```

Add import: `import TimeRangeSelector from '../components/dashboard/TimeRangeSelector';`

- [ ] **Step 3: Add `customOption` prop to YearSelector**

Open `frontend/src/components/dashboard/YearSelector.tsx`. After the existing `allowAllTime` prop, add `customOption`:

```tsx
export const CUSTOM_RANGE = -2;  // sentinel alongside ALL_YEARS = -1

interface YearSelectorProps {
  transactions: Transaction[];
  incomeEntries?: IncomeEntry[];
  value: number;
  onChange: (year: number) => void;
  allowAllTime?: boolean;
  customOption?: boolean;  // NEW
}
```

When `customOption` is true, append `<option value={CUSTOM_RANGE}>Custom…</option>` to the rendered options. Callers decide what to do when the user picks it (Task 8).

- [ ] **Step 4: Verify**

Run `npx tsc --noEmit` and `npm run build`. Both must be clean. Load the dashboard — Spending Trends tabs unchanged, Expenses by Category year selector unchanged.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/dashboard/TimeRangeSelector.tsx frontend/src/components/dashboard/YearSelector.tsx frontend/src/pages/Dashboard.tsx
git commit -m "refactor(dashboard): extract TimeRangeSelector; add YearSelector customOption"
```

---

### Task A1 (todo #1): Sortable drill-down columns

**Files:**
- Modify: `frontend/src/components/dashboard/TransactionDrillDown.tsx`

- [ ] **Step 1: Add sort state + helpers**

After the existing `selectedIds` useState declaration (~line 59), add:

```tsx
type SortKey = 'date' | 'description' | 'category' | 'amount';
type SortDir = 'asc' | 'desc';
const [sortKey, setSortKey] = useState<SortKey>('date');
const [sortDir, setSortDir] = useState<SortDir>('desc');

function toggleSort(key: SortKey) {
  if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
  else { setSortKey(key); setSortDir(key === 'date' ? 'desc' : 'asc'); }
}

const sortedEvents = [...events].sort((a, b) => {
  const dir = sortDir === 'asc' ? 1 : -1;
  switch (sortKey) {
    case 'date': return (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) * dir;
    case 'description':
      return a.description.localeCompare(b.description) * dir;
    case 'category':
      return (a.category ?? '').localeCompare(b.category ?? '') * dir;
    case 'amount': return (a.amount - b.amount) * dir;
  }
});
```

- [ ] **Step 2: Replace `events` references in render with `sortedEvents`**

Find these lines inside the component render:
- `selectedIds.size === events.length` (the "select all" checkbox `checked` attribute)
- `selectedIds.size > 0 && selectedIds.size < events.length` (indeterminate)
- `new Set(events.map(eventKey))` (inside `toggleAll`)
- `{events.map((e) => { … })}` (the row map)

Change each `events` to `sortedEvents`. Note: keep the prop name `events` — only the rendered collection changes.

- [ ] **Step 3: Make the sortable `<th>`s clickable with direction indicators**

Currently:
```tsx
<th>Date</th>
<th>Description</th>
<th style={{ width: 180 }}>Notes</th>
<th>Category</th>
<th className="num">Amount</th>
```

Replace with:
```tsx
<th onClick={() => toggleSort('date')} style={{ cursor: 'pointer', userSelect: 'none' }}>
  Date{sortKey === 'date' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
</th>
<th onClick={() => toggleSort('description')} style={{ cursor: 'pointer', userSelect: 'none' }}>
  Description{sortKey === 'description' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
</th>
<th style={{ width: 180 }}>Notes</th>
<th onClick={() => toggleSort('category')} style={{ cursor: 'pointer', userSelect: 'none' }}>
  Category{sortKey === 'category' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
</th>
<th className="num" onClick={() => toggleSort('amount')} style={{ cursor: 'pointer', userSelect: 'none' }}>
  Amount{sortKey === 'amount' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
</th>
```

Notes column stays unsortable (per scope — text sort is rarely useful for free-form notes).

- [ ] **Step 4: Verify**

Run `npx tsc --noEmit && npm run build`. In browser, open a drill-down (click a category in Expenses by Category). Click each header — rows reorder, chevron flips direction on second click.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/dashboard/TransactionDrillDown.tsx
git commit -m "feat(drill-down): sortable date/description/category/amount columns"
```

---

### Task A2 (todo #2): Spending Trends custom-range layout

**Files:**
- Modify: `frontend/src/components/charts/CategoryLineChart.tsx`

Currently the `DateRangePicker` renders AFTER the legend chips (around line 185 in the chart body). Move it to the top of the body, right-justified, so it appears directly under the card-header tabs.

- [ ] **Step 1: Move the DateRangePicker block to the top of the returned JSX**

Find the existing block wrapped in `{timeRange === 'custom' && onCustomRangeChange && (() => { … })()}`.

Cut it out of its current location and paste it as the first child inside the outer `<div>` returned by the component (before the legend chips div). Wrap it so it's right-justified:

```tsx
{timeRange === 'custom' && onCustomRangeChange && (() => {
  const toISODate = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date();
  const tenYearsAgo = new Date(today.getFullYear() - 10, today.getMonth(), today.getDate());
  const activeDates = transactions.filter((t) => !t.archived).map((t) => t.date).sort();
  const oldestStr = activeDates[0];
  const tenYearsAgoStr = toISODate(tenYearsAgo);
  const minDate = oldestStr && oldestStr > tenYearsAgoStr ? oldestStr : tenYearsAgoStr;
  const maxDate = toISODate(today);
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
      <DateRangePicker
        value={customRange ?? null}
        onChange={onCustomRangeChange}
        minDate={minDate}
        maxDate={maxDate}
      />
    </div>
  );
})()}
```

- [ ] **Step 2: Verify**

Run `npx tsc --noEmit && npm run build`. Select "Custom Range" in Spending Trends — picker appears at the top-right of the card body, directly under the tabs.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/charts/CategoryLineChart.tsx
git commit -m "feat(trends): right-justify custom range picker below tabs"
```

---

### Task A3 (todo #3): Spending Trends single-point node visibility

**Why:** Currently `<Line dot={false} />` means a lone datapoint is invisible — only hoverable via the invisible `activeDot`.

**Files:**
- Modify: `frontend/src/components/charts/CategoryLineChart.tsx`

- [ ] **Step 1: Enable dots when data has ≤1 point**

Find the existing Recharts `<Line>` rendering loop (around `allCategories.map((cat) => { … dot={false} … })`). Replace the `dot={false}` prop with:

```tsx
dot={data.length <= 1 ? {
  r: 4,
  strokeWidth: 2,
  stroke: getCategoryColor(cat),
  fill: 'var(--bg-card)',
} : false}
```

The activeDot prop stays untouched.

- [ ] **Step 2: Verify**

Run `npx tsc --noEmit && npm run build`. In browser: filter transactions to a date range containing only one day's data (or use Past Week when data is sparse). Nodes should be visible before and after hover.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/charts/CategoryLineChart.tsx
git commit -m "fix(trends): render dots when chart has a single datapoint"
```

---

### Task A4 (todo #4): Select All / Deselect All buttons on category chip lists

**Sites (from survey):**
1. `frontend/src/components/charts/CategoryLineChart.tsx` — legend CheckmarkToggle chips
2. `frontend/src/components/dashboard/ExpandedMonthView.tsx` — per-category chip row

**Files:**
- Modify: `frontend/src/components/charts/CategoryLineChart.tsx`
- Modify: `frontend/src/components/dashboard/ExpandedMonthView.tsx`

- [ ] **Step 1: Remove the min-1 guard in CategoryLineChart's `toggle`**

Find in CategoryLineChart:
```tsx
const toggle = useCallback((cat: Category) => {
  setActiveCategories((prev) => {
    const next = new Set(prev);
    if (next.has(cat)) {
      if (next.size === 1) return prev;  // <-- remove this guard
      next.delete(cat);
```

Delete the `if (next.size === 1) return prev;` line. Users can now deselect all; the chart renders empty (already handled by the existing `data.length === 0` empty-state branch — though that's based on points, not active categories, so separately: see Step 3).

- [ ] **Step 2: Append buttons to the legend row**

In CategoryLineChart, find the legend-row div (the one that maps `visibleCategories`). After the closing `)}` of that map (but still inside the same flex container, alongside the existing "Clear selection" conditional), insert two buttons BEFORE the Clear selection button:

```tsx
<button
  className="btn btn-ghost btn-sm"
  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
  onClick={() => setActiveCategories(new Set(visibleCategories))}
>
  Select All
</button>
<button
  className="btn btn-ghost btn-sm"
  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
  onClick={() => setActiveCategories(new Set())}
>
  Deselect All
</button>
```

- [ ] **Step 3: Handle all-deselected empty state**

Still in CategoryLineChart, find the existing empty-state check:
```tsx
if (data.length === 0) { … }
```

After it, add:
```tsx
if (activeCategories.size === 0) {
  return (
    <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
      No categories selected. Use the legend to pick some.
    </div>
  );
}
```

Actually — the legend must still render so the user can re-enable categories. Move this check AFTER the legend render but BEFORE the chart render. Restructure the return:

```tsx
return (
  <div>
    {/* legend (unchanged) */}
    {/* custom range picker (unchanged) */}
    {activeCategories.size === 0 ? (
      <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        No categories selected. Use the legend to pick some.
      </div>
    ) : (
      <>
        <p className="text-xs text-muted">Tip: …</p>
        <ResponsiveContainer>…</ResponsiveContainer>
      </>
    )}
  </div>
);
```

- [ ] **Step 4: Add Select/Deselect All to ExpandedMonthView**

Read `frontend/src/components/dashboard/ExpandedMonthView.tsx` first — find the existing `useState` that backs the CheckmarkToggle chips (per the survey, the chip list maps `categoryTotals` entries around lines 201–216). Note the exact setter name used by the chips' `onToggle` — that's the setter these buttons will call.

Append two buttons to the same flex container that renders the chips:

```tsx
<button
  className="btn btn-ghost btn-sm"
  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
  onClick={() => setActiveCategories(new Set(categoryTotals.map((c) => c.category)))}
>
  Select All
</button>
<button
  className="btn btn-ghost btn-sm"
  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
  onClick={() => setActiveCategories(new Set())}
>
  Deselect All
</button>
```

Adjust the handler logic to match the actual state-setter and data shape in that file — use the same state variable the existing per-chip `onToggle` writes to.

- [ ] **Step 5: Verify**

Run `npx tsc --noEmit && npm run build`. In browser:
- Spending Trends: click Deselect All → empty-state message + legend still rendered; click Select All → all lines return.
- Income vs Expenditures drill-down: open a month, test Select/Deselect All on the chip row.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/charts/CategoryLineChart.tsx frontend/src/components/dashboard/ExpandedMonthView.tsx
git commit -m "feat(dashboard): Select All / Deselect All on category chip lists"
```

---

### Task A5 (todo #7): Income vs Expenditures — remove bar chart + restyle net balance

**Files:**
- Modify: `frontend/src/components/dashboard/MonthlyBalanceView.tsx`
- Modify: `frontend/src/components/dashboard/NetBalanceView.tsx`

- [ ] **Step 1: Remove the grouped bar chart from MonthlyBalanceView**

Open `MonthlyBalanceView.tsx`. Delete the entire `<ResponsiveContainer>` block (lines ~68–107 per survey, containing the grouped `<BarChart>`). Keep the numeric table above it.

After removal the component returns only the table. Remove any now-unused imports (`BarChart`, `Bar`, `ResponsiveContainer`, `CartesianGrid`, `XAxis`, `YAxis`, `Tooltip`, `Legend`) to satisfy strict `noUnusedLocals`.

- [ ] **Step 2: NetBalanceView — 50% opacity bars + y=0 reference line**

Open `NetBalanceView.tsx`. In the `<Bar>` component, add `fillOpacity={0.5}`:

```tsx
<Bar dataKey="net" radius={[3, 3, 0, 0]} fillOpacity={0.5}>
  {monthlyBalance.map((entry, i) => (
    <Cell key={i} fill={entry.net >= 0 ? 'var(--success)' : 'var(--danger)'} />
  ))}
</Bar>
```

Adjust property names if the actual data key differs (read the file first to confirm — likely `surplus` or `net`).

Then add a `ReferenceLine` at y=0. Import `ReferenceLine` from recharts at the top, then add inside the `<BarChart>`:

```tsx
<ReferenceLine y={0} stroke="var(--text-muted)" strokeWidth={1} />
```

Place it after `<CartesianGrid />` and before `<Bar>` so the line renders under the bars.

- [ ] **Step 3: Verify**

Run `npx tsc --noEmit && npm run build`. Load dashboard — Income vs Expenditures card shows the numeric table, no grouped bars, then Net Balance with translucent bars and a thin y=0 line.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/dashboard/MonthlyBalanceView.tsx frontend/src/components/dashboard/NetBalanceView.tsx
git commit -m "feat(income): remove grouped bar chart; translucent net bars with y=0 line"
```

---

### Task A6 (todo #11): Average Monthly Expenditures layout

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx` — `avg-expenditures` case of `renderCard`

- [ ] **Step 1: Remove the horizontal bar chart; widen the progress-bar column**

In the `'avg-expenditures'` case of `renderCard`, delete the entire `<ResponsiveContainer>` block (the `<BarChart layout="vertical" …>`). Keep the `<div className="table-wrapper">` above it.

Change the existing `<th style={{ width: 160 }}></th>` to `<th style={{ width: '50%' }}></th>` so the progress-bar column takes the full remaining horizontal space.

Move that column to the right of Total (it already is — last `<td>`), and increase `.progress-bar-track`'s visual prominence via inline style on the track:

```tsx
<td>
  <div className="progress-bar-track" style={{ height: 14 }}>
    <div
      className="progress-bar-fill"
      style={{
        width: `${pct}%`,
        background: getCategoryColor(row.category),
        height: 14,
      }}
    />
  </div>
</td>
```

Remove now-unused imports at the top of `Dashboard.tsx`: `BarChart`, `Bar`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ResponsiveContainer`, `Cell` (if this is their only use — verify with tsc).

- [ ] **Step 2: Verify**

Run `npx tsc --noEmit && npm run build`. Load dashboard — Average Monthly Expenditures card shows table with wider, taller progress bars; no bar chart below.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx
git commit -m "feat(averages): drop bar chart, widen progress bars"
```

---

### Task A7 (todo #8): Custom range picker on all non-IvE cards

**Scope:** Add DateRangePicker access to Expenses by Category, Avg Monthly Expenditures, and All Transactions. Selecting "Custom…" in the year dropdown swaps the card's data filter from year-based to date-range-based.

**Files:**
- Modify: `frontend/src/utils/dataProcessing.ts` — add range-based variants of `buildMonthlyExpenseTable` and `buildCategoryAverages`
- Modify: `frontend/src/pages/Dashboard.tsx` — wire state + picker into the three cards
- Modify: `frontend/src/components/dashboard/AllTransactionsCard.tsx` — accept custom range

- [ ] **Step 1: Add range-filter helper**

Open `frontend/src/utils/dataProcessing.ts` and add this helper near the top (after imports):

```ts
import { CustomDateRange, Transaction } from '../types';

export function filterByRange(
  transactions: Transaction[],
  range: CustomDateRange | null,
): Transaction[] {
  if (!range) return transactions;
  return transactions.filter((t) => t.date >= range.start && t.date <= range.end);
}
```

- [ ] **Step 2a: Generalize `buildMonthlyExpenseTable` to produce dynamic (year, month) columns**

Open `frontend/src/utils/dataProcessing.ts`. Find `export function buildMonthlyExpenseTable(transactions, year)` around line 130. Refactor it to accept either a single year OR a `CustomDateRange`, and to return both the columns and the rows. Keep the existing year-mode behaviour intact so current callers don't break.

Change the signature and add a new exported type:

```ts
export interface MonthColumn {
  year: number;
  month: number; // 0-indexed
}

export interface MonthlyTableResult {
  columns: MonthColumn[];
  rows: Array<{ category: Category; months: number[]; total: number }>;
}

export function buildMonthlyExpenseTable(
  transactions: Transaction[],
  yearOrRange: number | CustomDateRange,
): MonthlyTableResult {
  // Build the column list first: for a year, it's Jan..Dec (or Jan..current month
  // for the current year). For a range, it's every (year, month) pair touched
  // by the range, inclusive of both endpoints.
  let columns: MonthColumn[];
  let filtered: Transaction[];

  if (typeof yearOrRange === 'number') {
    const year = yearOrRange;
    const now = new Date();
    const lastMonth = year < now.getFullYear() ? 11 : now.getMonth();
    columns = [];
    for (let m = 0; m <= lastMonth; m++) columns.push({ year, month: m });
    filtered = transactions.filter((t) => {
      if (t.archived || t.type !== 'expense') return false;
      return parseISO(t.date).getFullYear() === year;
    });
  } else {
    const { start, end } = yearOrRange;
    const startDate = parseISO(start);
    const endDate = parseISO(end);
    columns = [];
    const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const stop = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    while (cur <= stop) {
      columns.push({ year: cur.getFullYear(), month: cur.getMonth() });
      cur.setMonth(cur.getMonth() + 1);
    }
    filtered = transactions.filter((t) => {
      if (t.archived || t.type !== 'expense') return false;
      return t.date >= start && t.date <= end;
    });
  }

  // Bucket per category, per (year, month) column index.
  const colIndex = new Map<string, number>();
  columns.forEach((c, i) => colIndex.set(`${c.year}-${c.month}`, i));
  const byCategory = new Map<Category, number[]>();
  for (const t of filtered) {
    const d = parseISO(t.date);
    const idx = colIndex.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (idx === undefined) continue;
    const bucket = byCategory.get(t.category) ?? new Array(columns.length).fill(0);
    bucket[idx] += Math.abs(t.amount);
    byCategory.set(t.category, bucket);
  }

  const rows = Array.from(byCategory.entries())
    .map(([category, months]) => ({
      category,
      months,
      total: months.reduce((s, v) => s + v, 0),
    }))
    .sort((a, b) => b.total - a.total);

  return { columns, rows };
}
```

Remove any prior year-only implementation. Double-check imports (`parseISO` already imported at top of file).

- [ ] **Step 2b: Update callers of `buildMonthlyExpenseTable`**

In `Dashboard.tsx`, the call site currently is:

```tsx
const monthlyTable = buildMonthlyExpenseTable(transactions, expenseYear);
```

Change to use the range when active:

```tsx
const monthlyResult = buildMonthlyExpenseTable(
  transactions,
  expenseRange ?? expenseYear,
);
const monthlyTable = monthlyResult.rows;
const monthColumns = monthlyResult.columns;
```

Update the `<ExpenseCategoryTable>` props — pass `columns={monthColumns}` (added in Step 2c). The existing `currentMonth={expenseMonthCount - 1}` prop becomes obsolete because the columns array now dictates what renders; remove that prop from the call.

- [ ] **Step 2c: Update `ExpenseCategoryTable` to accept dynamic columns with optional year sub-labels**

Open `frontend/src/components/dashboard/ExpenseCategoryTable.tsx`. Update the props interface:

```tsx
import { MONTH_NAMES, MonthColumn, formatCurrency } from '../../utils/dataProcessing';

interface ExpenseCategoryTableProps {
  monthlyTable: Array<{ category: Category; months: number[]; total: number }>;
  columns: MonthColumn[];
  transactions: Transaction[];
  expandedCategory: Category | null;
  onSelect: (category: Category) => void;
  onDelete: (txnIds: string[], incIds: string[], label: string) => Promise<void>;
  onUpdateTransaction: (id: string, updates: Parameters<typeof updateTransaction>[1]) => Promise<void>;
  userCategories: UserCategories;
  addCustomCategory: (name: string) => string | null;
  isActiveOwner?: boolean;
}
```

(Drop the `currentMonth` prop — replaced by `columns`.)

Replace the `<thead>` block. Compute `showYearSublabel` from the columns array (true if columns span more than one distinct year). Render the month name on the first line and, when `showYearSublabel` is true, the year in a smaller muted line below:

```tsx
const showYearSublabel = new Set(columns.map((c) => c.year)).size > 1;

// ...
<thead>
  <tr>
    <th className="sticky-col-left">Category</th>
    {columns.map((c, ci) => (
      <th key={ci} className="num">
        <div>{MONTH_NAMES[c.month]}</div>
        {showYearSublabel && (
          <div style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--text-muted)' }}>
            {c.year}
          </div>
        )}
      </th>
    ))}
    <th className="num sticky-col-right">Total</th>
  </tr>
</thead>
```

Replace the existing `row.months.slice(0, currentMonth + 1).map(...)` with `row.months.map(...)` (columns always match row length now):

```tsx
{row.months.map((amt, mi) => (
  <td key={mi} className={`num ${amt === 0 ? 'zero' : ''}`}>
    {amt > 0 ? formatCurrency(amt) : '—'}
  </td>
))}
```

Replace the totals-row map similarly: `columns.map((_, mi) => { const monthTotal = monthlyTable.reduce((s, r) => s + r.months[mi], 0); ... })`.

- [ ] **Step 2d: Wire the custom-range state in Dashboard.tsx**

Alongside `const [expenseYear, …]`, add:

```tsx
const [expenseRange, setExpenseRange] = useState<CustomDateRange | null>(null);
```

Update the `'expenses-by-category'` case of `renderCard`. Replace the existing `<YearSelector>` headerAction with:

```tsx
<YearSelector
  transactions={transactions}
  value={expenseRange ? CUSTOM_RANGE : expenseYear}
  onChange={(y) => {
    if (y === CUSTOM_RANGE) {
      const today = new Date();
      setExpenseRange({
        start: `${today.getFullYear() - 1}-${String(today.getMonth() + 1).padStart(2, '0')}-01`,
        end: today.toISOString().slice(0, 10),
      });
    } else {
      setExpenseRange(null);
      setExpenseYear(y);
    }
  }}
  customOption
/>
```

Inside the card body, before `{monthlyTable.length === 0 …}`, conditionally render the DateRangePicker:

```tsx
{expenseRange && (() => {
  const today = new Date();
  const tenYearsAgo = new Date(today.getFullYear() - 10, today.getMonth(), today.getDate());
  const oldest = transactions.filter((t) => !t.archived).map((t) => t.date).sort()[0];
  const tenYrStr = tenYearsAgo.toISOString().slice(0, 10);
  const minDate = oldest && oldest > tenYrStr ? oldest : tenYrStr;
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
      <DateRangePicker
        value={expenseRange}
        onChange={setExpenseRange}
        minDate={minDate}
        maxDate={today.toISOString().slice(0, 10)}
      />
    </div>
  );
})()}
```

Add imports at the top of `Dashboard.tsx`:
```tsx
import DateRangePicker from '../components/DateRangePicker';
import { CUSTOM_RANGE } from '../components/dashboard/YearSelector';
```

Remove the obsolete `expenseMonthCount` computation and the `currentMonth={expenseMonthCount - 1}` prop from the `<ExpenseCategoryTable>` call (replaced by `columns={monthColumns}`).

- [ ] **Step 3: Wire Avg Monthly Expenditures**

Add state to `Dashboard.tsx`:
```tsx
const [avgRange, setAvgRange] = useState<CustomDateRange | null>(null);
```

In the `'avg-expenditures'` case, replace the text-only headerActions with a year selector + range:
```tsx
headerActions={
  <>
    <YearSelector
      transactions={transactions}
      value={avgRange ? CUSTOM_RANGE : (new Date().getFullYear())}
      onChange={(y) => {
        if (y === CUSTOM_RANGE) {
          const today = new Date();
          setAvgRange({
            start: `${today.getFullYear() - 1}-${String(today.getMonth() + 1).padStart(2, '0')}-01`,
            end: today.toISOString().slice(0, 10),
          });
        } else {
          setAvgRange(null);
        }
      }}
      customOption
    />
    <span className="text-xs text-muted">
      Over {categoryAveragesRanged[0]?.months ?? 0} month{(categoryAveragesRanged[0]?.months ?? 0) !== 1 ? 's' : ''} of data
    </span>
  </>
}
```

Compute `categoryAveragesRanged`:
```tsx
const categoryAveragesRanged = avgRange
  ? buildCategoryAverages(filterByRange(transactions, avgRange))
  : categoryAverages;
```

Replace all `categoryAverages` references in the avg-expenditures body with `categoryAveragesRanged`.

Add the DateRangePicker block (same pattern as Step 2) inside the card body when `avgRange` is set.

- [ ] **Step 4: Wire All Transactions**

In `AllTransactionsCard.tsx`, add internal range state and the same custom-option logic to its YearSelector + filtering:

```tsx
const [range, setRange] = useState<CustomDateRange | null>(null);
```

Modify the existing `events` useMemo filter:
```tsx
.filter((t) => {
  if (range) return t.date >= range.start && t.date <= range.end;
  if (year === ALL_YEARS) return true;
  return parseISO(t.date).getFullYear() === year;
})
```

Update the YearSelector:
```tsx
<YearSelector
  transactions={transactions}
  value={range ? CUSTOM_RANGE : year}
  onChange={(y) => {
    if (y === CUSTOM_RANGE) {
      const today = new Date();
      setRange({
        start: `${today.getFullYear() - 1}-${String(today.getMonth() + 1).padStart(2, '0')}-01`,
        end: today.toISOString().slice(0, 10),
      });
    } else {
      setRange(null);
      setYear(y);
    }
  }}
  allowAllTime
  customOption
/>
```

Below the search input, add the DateRangePicker conditionally on `range`.

Import `CUSTOM_RANGE`, `CustomDateRange`, `DateRangePicker`.

- [ ] **Step 5: Verify**

Run `npx tsc --noEmit && npm run build`. In browser:
- Expenses by Category → Custom… → picker appears. Month-grid persists but columns are dynamic. When the range spans multiple years, each month column header shows the year in a smaller line beneath the month name.
- Average Monthly Expenditures → Custom… → averages recompute over the selected range.
- All Transactions → Custom… → list filters to the range.
- Picking a normal year in any card clears the range and returns to single-year display.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx frontend/src/components/dashboard/AllTransactionsCard.tsx frontend/src/utils/dataProcessing.ts
git commit -m "feat(dashboard): custom date range across all cards except income-vs-exp"
```

---

### Task A8 (todo #9): 2× button sizes in dashboard cards

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Add scoped override at the end of the stylesheet**

Append to `frontend/src/index.css`:

```css
/* ─── Dashboard card buttons — 2x sizing override (excludes category chips) ── */
.card .btn { padding: 16px 32px; font-size: 1.0625rem; }
.card .btn-sm { padding: 10px 20px; font-size: 1rem; }
.card .btn-lg { padding: 22px 44px; font-size: 1.1875rem; }
/* CheckmarkToggle renders a <button> without .btn, so category chips are unaffected. */
/* Drag handle uses .dashboard-card-handle (no .btn class), also unaffected. */
```

- [ ] **Step 2: Verify**

Run `npx tsc --noEmit && npm run build`. In browser, compare any dashboard card's internal buttons (Back to all categories, Clear selection, etc.) to a settings-page button — dashboard buttons should be visibly larger. Category chips unchanged.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(dashboard): 2x button sizing inside cards (excludes chips)"
```

---

### Branch A: final check + PR

- [ ] Run `npm run build` one last time — clean.
- [ ] Smoke-test every card.
- [ ] Merge to main via the existing flow (user confirms merge). Delete branch after merge.

---

# Branch B: `feat/settings-extensions`

Base: `main` after Branch A is merged.

```bash
git checkout main && git pull
git checkout -b feat/settings-extensions
```

---

### Task B1 (todo #6): Remove workspaces sidebar from Settings page

**Interpretation:** "Instances tab" = the sticky `WorkspaceTabs` sidebar rendered by Layout. Hide it only on `/settings`. The `WorkspacesCard` inside Settings stays (that's the management UI).

**Files:**
- Modify: `frontend/src/components/layout/Layout.tsx`

- [ ] **Step 1: Hide the sidebar on the settings route**

Change:
```tsx
{currentUser && <WorkspaceTabs />}
```

to:
```tsx
{currentUser && path !== '/settings' && <WorkspaceTabs />}
```

- [ ] **Step 2: Verify**

Run `npx tsc --noEmit && npm run build`. Navigate to /settings — sidebar is gone. Dashboard shows the sidebar as before.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/layout/Layout.tsx
git commit -m "feat(settings): hide workspace sidebar on settings page"
```

---

### Task B2 (todo #12): 25% narrower inactive workspace tabs

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Add width rule**

Find the `.workspace-tab` block. After `.workspace-tab.active { … }`, add:

```css
.workspace-tab:not(.active) {
  width: 75%;
}
```

Since tabs live inside a 150px container, inactive tabs render at ~112px wide. Active tab stays full width.

- [ ] **Step 2: Verify**

Run `npm run build`. In browser: inactive workspace tabs are visibly narrower; active tab unchanged. Hover behavior intact.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(workspaces): shrink inactive tabs to 75% width"
```

---

### Task B3 (todo #5): Floating Enter Data button

**Files:**
- Modify: `frontend/src/components/layout/Layout.tsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Remove the navbar Enter Data button**

In `Layout.tsx`, delete the existing `<button className={`nav-link …`} onClick={openModal}>…Enter Data</button>` block (lines 36–48). Keep `openModal` — we'll still use it.

- [ ] **Step 2: Add a floating FAB rendered at the end of Layout**

After the closing `</div>` of `.page-wrapper`, before the final `</>`, insert:

```tsx
{currentUser && (path === '/dashboard' || path === '/settings') && (
  <button
    className="fab-enter-data"
    onClick={openModal}
    aria-label="Enter Data"
  >
    <span className="fab-enter-data-label">Enter Data</span>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  </button>
)}
```

- [ ] **Step 3: Add FAB CSS**

Append to `frontend/src/index.css`:

```css
/* ─── Floating Enter Data FAB ────────────────────────────────────────────── */
.fab-enter-data {
  position: fixed;
  right: 24px;
  bottom: 24px;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: var(--accent);
  color: #0f0f1a;
  border: none;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-weight: 600;
  font-size: 0.75rem;
  text-align: center;
  line-height: 1.1;
  z-index: 100;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.fab-enter-data:hover {
  transform: translateY(-2px);
  background: var(--accent-hover);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.5);
}
.fab-enter-data:active { transform: translateY(0); }
.fab-enter-data-label {
  font-size: 0.75rem;
  font-weight: 600;
}
```

- [ ] **Step 4: Verify**

Run `npx tsc --noEmit && npm run build`. In browser:
- Navbar no longer has Enter Data button.
- Dashboard + Settings pages show a circular FAB bottom-right with "Enter Data" text above the document icon.
- Click opens the data-entry modal.
- Login/other pages don't show the FAB.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/Layout.tsx frontend/src/index.css
git commit -m "feat(nav): floating Enter Data FAB on dashboard and settings"
```

---

### Task B4 (todo #10): Dashboard Card Visibility settings card

**Files:**
- Create: `frontend/src/hooks/useDashboardLayout.ts` — shared hook for cardOrder + minimized + hidden, per instance
- Modify: `frontend/src/pages/Dashboard.tsx` — replace inline localStorage logic with the hook; filter `cardOrder` by `hidden`
- Modify: `frontend/src/pages/Settings.tsx` — add the new card using the hook

- [ ] **Step 1: Define card labels + hook**

Create `frontend/src/hooks/useDashboardLayout.ts`:

```tsx
import { useEffect, useState, useCallback } from 'react';

export const CARD_IDS = [
  'spending-trends',
  'expenses-by-category',
  'income-vs-expenditures',
  'avg-expenditures',
  'all-transactions',
] as const;
export type CardId = (typeof CARD_IDS)[number];

export const CARD_LABELS: Record<CardId, string> = {
  'spending-trends': 'Spending Trends',
  'expenses-by-category': 'Expenses by Category',
  'income-vs-expenditures': 'Income vs. Expenditures',
  'avg-expenditures': 'Average Monthly Expenditures',
  'all-transactions': 'All Transactions',
};

const orderKey = (id: string) => `dashboard:cardOrder:${id}`;
const minKey = (id: string) => `dashboard:minimized:${id}`;
const hiddenKey = (id: string) => `dashboard:hidden:${id}`;

function reconcile(saved: string[] | null): CardId[] {
  if (!saved) return [...CARD_IDS];
  const valid = saved.filter((id): id is CardId => (CARD_IDS as readonly string[]).includes(id));
  const missing = CARD_IDS.filter((id) => !valid.includes(id));
  return [...valid, ...missing];
}

function readSet(key: string): Set<CardId> {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(parsed.filter((id): id is CardId => (CARD_IDS as readonly string[]).includes(id)));
  } catch {
    return new Set();
  }
}

export function useDashboardLayout(instanceId: string | null | undefined) {
  const [cardOrder, setCardOrder] = useState<CardId[]>([...CARD_IDS]);
  const [minimized, setMinimized] = useState<Set<CardId>>(new Set());
  const [hidden, setHidden] = useState<Set<CardId>>(new Set());

  useEffect(() => {
    if (!instanceId) return;
    try {
      const raw = localStorage.getItem(orderKey(instanceId));
      setCardOrder(reconcile(raw ? (JSON.parse(raw) as string[]) : null));
    } catch {
      setCardOrder([...CARD_IDS]);
    }
    setMinimized(readSet(minKey(instanceId)));
    setHidden(readSet(hiddenKey(instanceId)));
  }, [instanceId]);

  useEffect(() => {
    if (!instanceId) return;
    localStorage.setItem(orderKey(instanceId), JSON.stringify(cardOrder));
  }, [cardOrder, instanceId]);

  useEffect(() => {
    if (!instanceId) return;
    localStorage.setItem(minKey(instanceId), JSON.stringify([...minimized]));
  }, [minimized, instanceId]);

  useEffect(() => {
    if (!instanceId) return;
    localStorage.setItem(hiddenKey(instanceId), JSON.stringify([...hidden]));
  }, [hidden, instanceId]);

  const toggleMinimized = useCallback((id: CardId) => {
    setMinimized((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleHidden = useCallback((id: CardId) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  return { cardOrder, setCardOrder, minimized, toggleMinimized, hidden, toggleHidden };
}
```

- [ ] **Step 2: Refactor Dashboard.tsx to use the hook**

Remove the inline `CARD_IDS`, `orderKey`, `minKey`, `reconcileOrder` definitions and the three localStorage `useEffect` blocks. Replace with:

```tsx
import { useDashboardLayout, CardId } from '../hooks/useDashboardLayout';

const { cardOrder, setCardOrder, minimized, toggleMinimized, hidden } =
  useDashboardLayout(activeInstanceId);

// Alias to minimizedCards if you'd rather keep existing variable names.
const minimizedCards = minimized;
const toggleMinimizedCard = toggleMinimized;
```

Update the rendered map to filter out hidden cards:

```tsx
<SortableContext items={cardOrder.filter((id) => !hidden.has(id))} strategy={verticalListSortingStrategy}>
  {cardOrder.filter((id) => !hidden.has(id)).map(renderCard)}
</SortableContext>
```

- [ ] **Step 3: Add the new settings card**

In `Settings.tsx`, after the existing Workspaces card, insert:

```tsx
import { useDashboardLayout, CARD_IDS, CARD_LABELS } from '../hooks/useDashboardLayout';
```

Inside the component, change the existing line

```tsx
const { isActiveOwner } = useWorkspaces();
```

to

```tsx
const { isActiveOwner, activeInstanceId } = useWorkspaces();
const { hidden, toggleHidden } = useDashboardLayout(activeInstanceId);
```

In the cards stack, after `<WorkspacesCard />`, render:

```tsx
<div className="card">
  <div className="card-header">
    <h2>Dashboard Card Visibility</h2>
    <span className="text-xs text-muted">{CARD_IDS.length - hidden.size} visible</span>
  </div>
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    {CARD_IDS.map((id) => (
      <label key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span>{CARD_LABELS[id]}</span>
        <input
          type="checkbox"
          checked={!hidden.has(id)}
          onChange={() => toggleHidden(id)}
        />
      </label>
    ))}
  </div>
</div>
```

- [ ] **Step 4: Verify**

Run `npx tsc --noEmit && npm run build`. In browser:
- Settings → toggle a card off → return to Dashboard → card is gone.
- Toggle back on → card reappears in its previous position.
- Change workspace → each instance remembers its own hidden set.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useDashboardLayout.ts frontend/src/pages/Dashboard.tsx frontend/src/pages/Settings.tsx
git commit -m "feat(settings): Dashboard Card Visibility card + shared layout hook"
```

---

### Task B5 (todo #13): Feature Request card in Settings

**Handling approach:** Feature requests POST to a new worker endpoint; worker stores them in KV for later admin review.

**Alternatives considered:**
- `mailto:` link — zero backend, but loses structure and can't be triaged.
- Discord/Slack webhook — adds a third-party dependency.
- GitHub Issues API — requires a PAT with repo scope; overkill for this volume.

KV storage wins on simplicity + control. If you prefer a different route, redirect before Step 2 is implemented.

**Files:**
- Modify: `worker/src/index.ts` — add POST + GET endpoints
- Modify: `worker/src/types.ts` (if present) — add `FeatureRequest` type
- Modify: `frontend/src/api/client.ts` — add `submitFeatureRequest`, `listFeatureRequests`
- Modify: `frontend/src/pages/Settings.tsx` — new card(s)
- Create: `frontend/src/components/FeatureRequestCard.tsx` — textarea + submit for all users
- Create: `frontend/src/components/FeatureRequestsAdminCard.tsx` — list view for admin only

- [ ] **Step 1: Worker endpoint**

Open `worker/src/index.ts`. Find the authenticated routes section (where other user endpoints live). Add:

```ts
// POST /api/feature-requests — submit a new feature request
if (request.method === 'POST' && url.pathname === '/api/feature-requests') {
  const auth = await authenticateUser(request, env);
  if (!auth.ok) return json({ error: 'Unauthorized' }, 401);
  const body = await request.json() as { text?: unknown };
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text || text.length > 2000) {
    return json({ error: 'Text required (≤2000 chars).' }, 400);
  }
  const createdAt = new Date().toISOString();
  const shortId = crypto.randomUUID().slice(0, 8);
  const key = `feature-requests:${createdAt}:${shortId}`;
  const record = { id: shortId, username: auth.username, text, createdAt, status: 'new' };
  await env.FINANCE_KV.put(key, JSON.stringify(record));
  return json({ ok: true, id: shortId });
}

// GET /api/feature-requests — admin only, returns all submissions newest-first
if (request.method === 'GET' && url.pathname === '/api/feature-requests') {
  const auth = await authenticateUser(request, env);
  if (!auth.ok) return json({ error: 'Unauthorized' }, 401);
  if (auth.username !== 'admin') return json({ error: 'Forbidden' }, 403);
  const list = await env.FINANCE_KV.list({ prefix: 'feature-requests:' });
  const items = await Promise.all(list.keys.map(async (k) => {
    const v = await env.FINANCE_KV.get(k.name);
    return v ? JSON.parse(v) : null;
  }));
  const sorted = items.filter(Boolean).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return json({ items: sorted });
}
```

Names of `authenticateUser`, `json`, and `env.FINANCE_KV` may differ — match the patterns already used in this file.

- [ ] **Step 2: Frontend API client**

In `frontend/src/api/client.ts`, add:

```ts
export interface FeatureRequest {
  id: string;
  username: string;
  text: string;
  createdAt: string;
  status: 'new' | 'reviewed' | 'planned' | 'done';
}

export async function submitFeatureRequest(text: string): Promise<void> {
  await request('/api/feature-requests', { method: 'POST', body: JSON.stringify({ text }) });
}

export async function listFeatureRequests(): Promise<FeatureRequest[]> {
  const res = await request<{ items: FeatureRequest[] }>('/api/feature-requests', { method: 'GET' });
  return res.items;
}
```

Match the existing helpers in this file — e.g., if it uses `apiFetch` rather than `request`, use that.

- [ ] **Step 3: FeatureRequestCard (user-facing)**

Create `frontend/src/components/FeatureRequestCard.tsx`:

```tsx
import { useState } from 'react';
import { submitFeatureRequest } from '../api/client';

export default function FeatureRequestCard() {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setBusy(true);
    setStatus(null);
    try {
      await submitFeatureRequest(trimmed);
      setText('');
      setStatus({ kind: 'success', msg: 'Thanks — we got it.' });
    } catch (err) {
      setStatus({ kind: 'error', msg: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2>Feature Request</h2>
      </div>
      <p className="text-sm text-muted" style={{ marginBottom: 12 }}>
        Got an idea? Send it here — we read every submission.
      </p>
      <textarea
        className="input"
        rows={4}
        maxLength={2000}
        placeholder="What would you like to see?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ width: '100%', marginBottom: 8, resize: 'vertical' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          className="btn btn-primary"
          disabled={busy || text.trim().length === 0}
          onClick={handleSubmit}
        >
          {busy ? 'Sending…' : 'Submit'}
        </button>
        {status && (
          <span className={`text-xs ${status.kind === 'success' ? 'text-success' : 'text-danger'}`}>
            {status.msg}
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: FeatureRequestsAdminCard (admin only)**

Create `frontend/src/components/FeatureRequestsAdminCard.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { FeatureRequest, listFeatureRequests } from '../api/client';

export default function FeatureRequestsAdminCard() {
  const [items, setItems] = useState<FeatureRequest[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    listFeatureRequests()
      .then(setItems)
      .catch((e) => setErr((e as Error).message));
  }, []);

  if (err) {
    return (
      <div className="card">
        <div className="card-header"><h2>Feature Requests (admin)</h2></div>
        <p className="text-sm text-danger">{err}</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2>Feature Requests (admin)</h2>
        <span className="text-xs text-muted">{items.length} total</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted">No submissions yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((it) => (
            <div key={it.id} style={{ borderLeft: '3px solid var(--accent-dim)', padding: '6px 12px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                {it.username} · {it.createdAt.slice(0, 10)}
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{it.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Wire into Settings.tsx**

Near the top:
```tsx
import FeatureRequestCard from '../components/FeatureRequestCard';
import FeatureRequestsAdminCard from '../components/FeatureRequestsAdminCard';
```

In the cards stack, after the new Dashboard Card Visibility card:
```tsx
<FeatureRequestCard />
{currentUser === 'admin' && <FeatureRequestsAdminCard />}
```

- [ ] **Step 6: Verify**

Run `npx tsc --noEmit && npm run build`. Start `wrangler dev` for the worker (if iterating locally) or deploy.

In browser:
- As any user: type a request and submit → success message, textarea clears.
- As admin: the admin card lists all submissions, newest first.

- [ ] **Step 7: Commit**

```bash
git add worker/src frontend/src/api/client.ts frontend/src/components/FeatureRequestCard.tsx frontend/src/components/FeatureRequestsAdminCard.tsx frontend/src/pages/Settings.tsx
git commit -m "feat(settings): feature request submission + admin viewer"
```

---

### Branch B: final check + PR

- [ ] Run `npm run build` clean in `frontend/`; `wrangler deploy --dry-run` clean in `worker/`.
- [ ] Smoke-test Settings page end-to-end.
- [ ] Merge to main. Delete branch.

---

## Traceability

Every todo.txt item maps to exactly one task:

| todo | Task | Branch |
|---|---|---|
| 1 | A1 | A |
| 2 | A2 | A |
| 3 | A3 | A |
| 4 | A4 | A |
| 5 | B3 | B |
| 6 | B1 | B |
| 7 | A5 | A |
| 8 | A7 | A |
| 9 | A8 | A |
| 10 | B4 | B |
| 11 | A6 | A |
| 12 | B2 | B |
| 13 | B5 | B |

Task A0 is infrastructure shared by A2 and A7.
