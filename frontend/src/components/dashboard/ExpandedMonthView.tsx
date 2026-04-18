import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Transaction, IncomeEntry, Category, UserCategories } from '../../types';
import { updateTransaction, updateIncome } from '../../api/client';
import {
  buildDailyBalance, buildMonthEvents, formatCurrency, MONTH_NAMES,
} from '../../utils/dataProcessing';
import { getCategoryColor } from '../../utils/categories';
import CategorySelect, { NEW_CATEGORY_SENTINEL } from '../CategorySelect';
import { INCOME_COLOR, EXPENSE_COLOR } from './constants';

// ─── Monthly balance: expanded (per-month) view ────────────────────────────

interface ExpandedMonthViewProps {
  transactions: Transaction[];
  incomeEntries: IncomeEntry[];
  year: number;
  month: number; // 0–11
  onDelete: (txnIds: string[], incIds: string[], label: string) => Promise<void>;
  onUpdateTransaction: (id: string, updates: Parameters<typeof updateTransaction>[1]) => Promise<void>;
  onUpdateIncome: (id: string, updates: Parameters<typeof updateIncome>[1]) => Promise<void>;
  userCategories: UserCategories;
  addCustomCategory: (name: string) => string | null;
}

interface MonthEditDraft {
  id: string;
  kind: 'expense' | 'income';
  date: string;
  description: string;
  category: Category; // only meaningful for expenses
  amount: string;
}

function ExpandedMonthView({
  transactions,
  incomeEntries,
  year,
  month,
  onDelete,
  onUpdateTransaction,
  onUpdateIncome,
  userCategories,
  addCustomCategory,
}: ExpandedMonthViewProps) {
  const dailyBalance = buildDailyBalance(transactions, incomeEntries, year, month);
  const events = buildMonthEvents(transactions, incomeEntries, year, month);

  // Multi-select state: composite keys like "txn:uuid" / "inc:uuid".
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editDraft, setEditDraft] = useState<MonthEditDraft | null>(null);

  // Clear selection + search when the expanded month changes
  useEffect(() => {
    setSelectedKeys(new Set());
    setSearchQuery('');
    setEditDraft(null);
  }, [year, month]);

  // Search filter layered on top of the chronological event list
  const filteredEvents = searchQuery.trim()
    ? events.filter((e) => e.description.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : events;

  const eventKey = (e: { kind: 'income' | 'expense'; id: string }) => `${e.kind === 'income' ? 'inc' : 'txn'}:${e.id}`;

  function toggleOne(e: { kind: 'income' | 'expense'; id: string }) {
    setSelectedKeys((prev) => {
      const k = eventKey(e);
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  function toggleAll() {
    setSelectedKeys((prev) => {
      if (prev.size === filteredEvents.length) return new Set();
      return new Set(filteredEvents.map((e) => eventKey(e)));
    });
  }

  function partitionSelection(): { txnIds: string[]; incIds: string[] } {
    const txnIds: string[] = [];
    const incIds: string[] = [];
    for (const k of selectedKeys) {
      const [kind, id] = k.split(':');
      if (kind === 'txn') txnIds.push(id);
      else if (kind === 'inc') incIds.push(id);
    }
    return { txnIds, incIds };
  }

  async function deleteSelected() {
    if (selectedKeys.size === 0) return;
    const n = selectedKeys.size;
    if (!window.confirm(`Delete ${n} selected entr${n !== 1 ? 'ies' : 'y'}?`)) return;
    const { txnIds, incIds } = partitionSelection();
    setBusy(true);
    try {
      await onDelete(txnIds, incIds, `Deleted ${n} entr${n !== 1 ? 'ies' : 'y'} from ${MONTH_NAMES[month]} ${year}.`);
      setSelectedKeys(new Set());
    } finally {
      setBusy(false);
    }
  }

  async function deleteOne(e: { kind: 'income' | 'expense'; id: string; description: string }) {
    if (!window.confirm(`Delete "${e.description}"?`)) return;
    setBusy(true);
    try {
      if (e.kind === 'income') {
        await onDelete([], [e.id], `Deleted income entry "${e.description}".`);
      } else {
        await onDelete([e.id], [], `Deleted "${e.description}".`);
      }
    } finally {
      setBusy(false);
    }
  }

  function startEdit(e: { id: string; kind: 'income' | 'expense'; date: string; description: string; category?: Category; amount: number }) {
    setEditDraft({
      id: e.id,
      kind: e.kind,
      date: e.date,
      description: e.description,
      category: e.category ?? 'Other',
      amount: Math.abs(e.amount).toFixed(2),
    });
  }

  function cancelEdit() {
    setEditDraft(null);
  }

  async function saveEdit() {
    if (!editDraft) return;
    const amt = parseFloat(editDraft.amount);
    if (isNaN(amt) || amt <= 0) {
      window.alert('Please enter a valid positive amount.');
      return;
    }
    setBusy(true);
    try {
      if (editDraft.kind === 'expense') {
        await onUpdateTransaction(editDraft.id, {
          date: editDraft.date,
          description: editDraft.description.trim(),
          category: editDraft.category,
          amount: -amt,
        });
      } else {
        await onUpdateIncome(editDraft.id, {
          date: editDraft.date,
          description: editDraft.description.trim(),
          grossAmount: amt,
          netAmount: amt,
        });
      }
      setEditDraft(null);
    } finally {
      setBusy(false);
    }
  }

  function handleEditCategoryPick(picked: string) {
    if (!editDraft) return;
    if (picked === NEW_CATEGORY_SENTINEL) {
      const input = window.prompt('Name for the new category:');
      if (!input) return;
      const name = addCustomCategory(input);
      if (!name) return;
      setEditDraft({ ...editDraft, category: name });
      return;
    }
    setEditDraft({ ...editDraft, category: picked });
  }

  // Per-category totals for quick reference above the chronological list
  const categoryTotals = new Map<Category, number>();
  let incomeTotal = 0;
  events.forEach((e) => {
    if (e.kind === 'income') {
      incomeTotal += e.amount;
    } else if (e.category) {
      categoryTotals.set(e.category, (categoryTotals.get(e.category) ?? 0) + e.amount);
    }
  });

  return (
    <>
      {/* Daily trend bar chart — no surplus/deficit bars in expanded mode */}
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={dailyBalance} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
            label={{ value: `Day of ${MONTH_NAMES[month]}`, position: 'insideBottom', offset: -4, fill: 'var(--text-muted)', fontSize: 11 }}
          />
          <YAxis
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
          />
          <Tooltip
            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.8125rem' }}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            labelFormatter={(label: string) => `${MONTH_NAMES[month]} ${label}`}
            formatter={(value: number, name: string) => [formatCurrency(value), name]}
          />
          <Legend wrapperStyle={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }} />
          <Bar dataKey="income" name="Income" fill={INCOME_COLOR} radius={[3, 3, 0, 0]} />
          <Bar dataKey="expenses" name="Expenses" fill={EXPENSE_COLOR} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Category summary for the month */}
      {categoryTotals.size > 0 && (
        <div style={{ marginTop: 24, borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
          <h3 style={{ marginBottom: 12, color: 'var(--text-secondary)' }}>
            {MONTH_NAMES[month]} {year} summary
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {incomeTotal > 0 && (
              <span
                className="chip"
                style={{
                  background: 'var(--success-bg)',
                  color: 'var(--success)',
                  border: '1px solid rgba(74,222,128,0.25)',
                  padding: '4px 10px',
                }}
              >
                Income: {formatCurrency(incomeTotal)}
              </span>
            )}
            {[...categoryTotals.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([cat, total]) => (
                <span
                  key={cat}
                  className="chip"
                  style={{
                    background: `${getCategoryColor(cat)}18`,
                    color: getCategoryColor(cat),
                    border: `1px solid ${getCategoryColor(cat)}40`,
                    padding: '4px 10px',
                  }}
                >
                  {cat}: {formatCurrency(total)}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Chronological events list */}
      <div style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
          <h3 style={{ color: 'var(--text-secondary)' }}>
            Activity — oldest to newest
            <span className="text-xs text-muted" style={{ marginLeft: 8 }}>
              ({filteredEvents.length} of {events.length} entr{events.length !== 1 ? 'ies' : 'y'})
            </span>
          </h3>
          {selectedKeys.size > 0 && (
            <button
              className="btn btn-sm btn-danger"
              onClick={deleteSelected}
              disabled={busy}
            >
              {busy ? <span className="spinner" /> : `Delete selected (${selectedKeys.size})`}
            </button>
          )}
        </div>

        <input
          type="text"
          className="input"
          placeholder="Search descriptions…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ marginBottom: 12, maxWidth: 360 }}
        />

        {events.length === 0 ? (
          <p className="text-muted text-sm">No activity recorded for {MONTH_NAMES[month]} {year}.</p>
        ) : filteredEvents.length === 0 ? (
          <p className="text-muted text-sm">No entries matching "{searchQuery}".</p>
        ) : (
          <div className="preview-scroll" style={{ maxHeight: 420 }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}>
                    <input
                      type="checkbox"
                      checked={selectedKeys.size === filteredEvents.length && filteredEvents.length > 0}
                      ref={(el) => {
                        if (el) {
                          el.indeterminate = selectedKeys.size > 0 && selectedKeys.size < filteredEvents.length;
                        }
                      }}
                      onChange={toggleAll}
                      title="Select all / none"
                    />
                  </th>
                  <th>Date</th>
                  <th>Type / Category</th>
                  <th>Description</th>
                  <th className="num">Amount</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((e) => {
                  const isSelected = selectedKeys.has(eventKey(e));
                  const isEditing = editDraft?.id === e.id;

                  if (isEditing) {
                    return (
                      <tr key={eventKey(e)} style={{ background: 'var(--accent-dim)' }}>
                        <td></td>
                        <td>
                          <input
                            type="date"
                            className="input"
                            style={{ padding: '4px 8px', fontSize: '0.8125rem' }}
                            value={editDraft.date}
                            onChange={(ev) => setEditDraft({ ...editDraft, date: ev.target.value })}
                          />
                        </td>
                        <td>
                          {editDraft.kind === 'expense' ? (
                            <CategorySelect
                              value={editDraft.category}
                              customCategories={userCategories.customCategories}
                              onChange={handleEditCategoryPick}
                              compact
                            />
                          ) : (
                            <span className="chip" style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid rgba(74,222,128,0.25)' }}>
                              Income
                            </span>
                          )}
                        </td>
                        <td>
                          <input
                            type="text"
                            className="input"
                            style={{ padding: '4px 8px', fontSize: '0.8125rem' }}
                            value={editDraft.description}
                            onChange={(ev) => setEditDraft({ ...editDraft, description: ev.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="input num"
                            style={{ padding: '4px 8px', fontSize: '0.8125rem' }}
                            value={editDraft.amount}
                            onChange={(ev) => setEditDraft({ ...editDraft, amount: ev.target.value })}
                          />
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-sm btn-primary" onClick={saveEdit} disabled={busy} title="Save" style={{ padding: '4px 8px' }}>✓</button>
                            <button className="btn btn-sm btn-ghost" onClick={cancelEdit} disabled={busy} title="Cancel" style={{ padding: '4px 8px' }}>✕</button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={eventKey(e)} style={isSelected ? { background: 'var(--accent-dim)' } : undefined}>
                      <td>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(e)}
                        />
                      </td>
                      <td className="text-sm font-mono" style={{ whiteSpace: 'nowrap' }}>{e.date}</td>
                      <td>
                        {e.kind === 'income' ? (
                          <span
                            className="chip"
                            style={{
                              background: 'var(--success-bg)',
                              color: 'var(--success)',
                              border: '1px solid rgba(74,222,128,0.25)',
                            }}
                          >
                            Income
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: e.category ? getCategoryColor(e.category) : 'var(--text-muted)',
                                flexShrink: 0,
                              }}
                            />
                            {e.category ?? 'Expense'}
                          </span>
                        )}
                      </td>
                      <td>{e.description}</td>
                      <td className={`num ${e.kind === 'income' ? 'text-success' : 'text-danger'}`}>
                        {e.kind === 'income' ? '+' : ''}{formatCurrency(e.amount)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 2 }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => startEdit(e)}
                            disabled={busy}
                            title="Edit"
                            style={{ padding: '4px 8px' }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => deleteOne(e)}
                            disabled={busy}
                            title="Delete"
                            style={{ padding: '4px 8px' }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export default ExpandedMonthView;
