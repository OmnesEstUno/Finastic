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

### Duplication
(Populated in Phases 2–3.)

### Security
(Populated in Phase 5.)

### Concurrency / Data Integrity
(Populated in Phase 6.)

### Hard-coded Values
(Populated in Phase 4.)

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
