# Lotus Code Review Findings — 2026-04-23

## Scope
Full review of frontend/ and worker/ per the code-review-cleanup plan.

## Baseline
- Starting LOC (Phase 0): 11,750 (frontend/src + worker/src, .ts/.tsx/.css)
- Starting branch: `chore/code-review-cleanup` off `main` @ `023a6a4`
- Worktree: `/var/home/Grey/.config/superpowers/worktrees/Lotus/code-review-cleanup`

## Executive Summary
- Duplication: worker/src/invites.ts and workspace-invites.ts are ~90% identical.
- Security: Missing rate limiting on login/TOTP; read-modify-write races on all bulk mutations.
- Mobile: Only one breakpoint (640px); many fixed px dimensions; ~18 static inline style blocks.
- RN portability: 11+ localStorage sites, 15+ window.alert/confirm/prompt sites, 4 recharts components, 1 pdfjs dependency, 1 qrcode component, 1 react-datepicker component.

## Findings by Category

### Dead Code / Unused Imports

**Task 1.1 result: No unused imports found.**

All `.ts` / `.tsx` files under `frontend/src/` and `worker/src/` were scanned. Every imported symbol is referenced at least once outside its import line. Verification approach:

1. `tsc --noEmit` with `noUnusedLocals: true` — zero errors on both frontend and worker.
2. Manual grep of each imported symbol in all 6 known-heavy files (DataEntry.tsx, Dashboard.tsx, Settings.tsx, Login.tsx, TransactionDrillDown.tsx, worker/src/index.ts) — all symbols referenced.
3. Manual grep of every import in every remaining `.ts`/`.tsx` file — all symbols referenced.

**Notable observation (not an unused import, note for style cleanup):**
- `frontend/src/components/charts/CategoryLineChart.tsx` imports from `'../../types'` in two separate `import` statements (line 12 and line 15). Both are used; they could be merged into one statement for tidiness. This is a style issue, not an unused import, and is out of scope for Task 1.1.

**Task 1.2 result: 5 dead exports removed; 2 flagged spots resolved; no commented-out code found.**

Dead exports removed:

| File | Symbol | Rationale |
|------|--------|-----------|
| `frontend/src/utils/dedup.ts` | `export function transactionDedupKey` | Only called within `dedup.ts` itself (`buildExistingDedupLookup`, `recordRowInBatch`). No external imports. De-exported (kept, visibility reduced). |
| `frontend/src/utils/dedup.ts` | `export function incomeDedupKey` | Same — only called internally. De-exported. |
| `frontend/src/utils/dedup.ts` | `export function rowDedupKey` | Same — only called internally. De-exported. |
| `frontend/src/hooks/useDashboardLayout.ts` | `export const CARD_IDS` | Only used within `useDashboardLayout.ts`. External consumers import `CardId` (the type) and `CARD_LABELS`, but not `CARD_IDS` itself. De-exported. |
| `frontend/src/pages/Settings.tsx` | `export type { UserCategories }` | Re-export stub with comment "for use elsewhere if needed". All consumers import `UserCategories` from `'../types'` directly — none import it from `Settings`. Removed re-export + now-unused import from Settings. |

Flagged spots:

- **`Dashboard.tsx:137` eslint-disable** — KEPT and replaced with explanatory `// eslint-disable-next-line` comment. The disable is load-bearing: the effect runs `setLoading(false)` on mount only as the "initial load" no-instance path. `refetchAll` has stable identity (`useCallback(…, [])`), but `activeInstanceId` must NOT be added because a second effect at lines 140–147 already handles workspace-change refetches; adding `activeInstanceId` here would reset loading to `false` at the same tick the second effect sets it to `true`, causing a visible flash. The empty-deps intent is correct.

- **`Logo.tsx` ASPECT constant** — INLINED. `ASPECT = 180 / 120` was used exactly once; inlined as the literal `1.5` with a trailing comment `// 180/120 aspect ratio`. The aspect ratio description moved into the JSDoc comment above the function. No readability loss.

Commented-out code sweep: 415 non-TODO/NOTE/FIXME comment lines audited. All are section headers, inline explanations, or instructional prose. Zero abandoned code blocks found.

**Task 1.2 (follow-up): 2 additional dead exports removed (missed in prior sweep).**

- `frontend/src/components/charts/CategoryLineChart.tsx`: removed dead export of `Props as CategoryLineChartProps` (no external consumers)
- `frontend/src/components/dashboard/TimeRangeSelector.tsx`: removed dead `export { TIME_RANGE_LABELS }` (internal-only)

### Duplication
(Populated in Phases 2–3.)

### Security
(Populated in Phase 5.)

### Concurrency / Data Integrity
(Populated in Phase 6.)

### Hard-coded Values

**Task 4.2 result: 24 replacements across 11 source files; all literals migrated to `frontend/src/utils/constants.ts`.**

#### Storage Keys (`STORAGE_KEYS`)

`STORAGE_KEYS.HIDDEN` was added to the constant object as part of this task (the other five keys already existed from Task 4.1).

| Constant | Replaced in file(s) | Count |
|----------|--------------------|----|
| `STORAGE_KEYS.TOKEN` | `api/client.ts` | 3 |
| `STORAGE_KEYS.USERNAME` | `api/client.ts` | 4 |
| `STORAGE_KEYS.ACTIVE_INSTANCE` | `api/client.ts` (was `ACTIVE_INSTANCE_STORAGE_KEY`) | 4 |
| `STORAGE_KEYS.PENDING_WORKSPACE_INVITE` | `pages/WorkspaceInvitePage.tsx`, `pages/Login.tsx` | 5 |
| `STORAGE_KEYS.DASHBOARD_ORDER` | `hooks/useDashboardLayout.ts` | 2 |
| `STORAGE_KEYS.DASHBOARD_MINIMIZED` | `hooks/useDashboardLayout.ts` | 2 |
| `STORAGE_KEYS.HIDDEN` | `hooks/useDashboardLayout.ts` | 2 |

#### Unix Ms Multiplier (`UNIX_MS_MULTIPLIER`)

| Constant | Replaced in file(s) | Count |
|----------|--------------------|----|
| `UNIX_MS_MULTIPLIER` (was `* 1000`) | `components/InviteTokensCard.tsx`, `components/WorkspacesCard.tsx`, `pages/WorkspaceInvitePage.tsx` | 3 |

Not replaced: `frontend/src/utils/dataProcessing.ts:92` — `span / (24 * 60 * 60 * 1000)` converts milliseconds to days; this is a different domain (ms→days, not unix→ms) and has no matching constant.

#### Timing Constants

| Constant | Replaced in file(s) | Count |
|----------|--------------------|----|
| `TOAST_DEFAULT_DURATION_MS` (was `5000`) | `components/Toast.tsx` | 1 |
| `TOAST_TICK_INTERVAL_MS` (was `50`) | `components/Toast.tsx` | 1 |
| `SUCCESS_FLASH_DURATION_MS` (was `1200`) | `pages/DataEntry.tsx` | 3 |
| `TOUCH_SENSOR_DELAY_MS` (was `200`) | `pages/Dashboard.tsx`, `pages/Settings.tsx` | 2 |
| `TOUCH_SENSOR_TOLERANCE_PX` (was `5`) | `pages/Dashboard.tsx`, `pages/Settings.tsx` | 2 |

Not replaced: `transition: 'width 50ms linear'` in `Toast.tsx` — this is a CSS duration string (not a JS numeric literal), a distinct value that happens to match `TOAST_TICK_INTERVAL_MS` only coincidentally.

#### Chart Constants

| Constant | Replaced in file(s) | Count |
|----------|--------------------|----|
| `CHART_HEIGHT_PX` (was `400`) | `components/charts/CategoryLineChart.tsx` | 1 |
| `CHART_Y_AXIS_HEADROOM` (was `1.1`) | `components/charts/CategoryLineChart.tsx` | 1 |
| `CHART_Y_TICK_STEP` (was `50`) | `components/charts/CategoryLineChart.tsx` | 2 |

#### Year-Range Constants

| Constant | Replaced in file(s) | Count |
|----------|--------------------|----|
| `YEAR_LOOKBACK` (was `- 10`) | `components/DateRangePicker.tsx`, `pages/Dashboard.tsx` | 3 |
| `YEAR_LOOKFORWARD` (was `+ 10`) | `components/DateRangePicker.tsx` | 1 |

#### Auth-Validation Constants

| Constant | Replaced in file(s) | Count |
|----------|--------------------|----|
| `PASSWORD_MIN_LENGTH` (was `8`) | `pages/Login.tsx` | 2 |
| `USERNAME_REGEX` (was `/^[a-z0-9_-]{3,32}$/`) | `pages/Login.tsx` | 2 |
| `USERNAME_HINT` (was `'3–32 characters: lowercase letters, digits, underscore, or dash.'`) | `pages/Login.tsx` | 2 |

Note: The error message strings `'Username must be 3–32 characters...'` were NOT replaced with `USERNAME_HINT` because they contain additional prose (`'Username must be '` prefix) and do not match the constant's value verbatim.

### CSS / Responsive Units
(Populated in Phases 7–9.)

### Inline Styles
(Populated in Phase 10.)

### Resource Leaks
(Populated in Phase 11.)

### Error Handling
(Populated in Phase 12.)

## Mobile / React Native Readiness
(Populated in Phase 13.)
