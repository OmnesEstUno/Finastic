# Lotus Code Review & Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Perform a thorough review + cleanup pass on the Lotus web app (React+Vite frontend, Cloudflare Worker backend) — remove dead code, consolidate duplication, harden security, extract magic numbers, convert CSS to responsive units, move static inline styles to CSS, fix resource leaks, and document the surface area that the next agent will need to cross for a React Native port with offline support.

**Architecture:** The work proceeds in phases. Early phases (1–3) are low-risk cleanups with no behavior change (unused imports, dead code, static style extraction). Middle phases (4–8) are refactors that touch behavior (security hardening, concurrency, magic numbers, component dedup). Late phases (9–11) prepare for mobile/RN (responsive CSS, storage/dialog abstractions, readiness report). Each task produces a self-contained commit. Never skip verification steps.

**Tech Stack:** React 18 + Vite + TypeScript, Recharts, PapaParse, pdf.js, Cloudflare Worker (Web Crypto), KV storage, dnd-kit, qrcode.react, react-datepicker.

**Verification baseline:** `npm --prefix frontend run build` must pass after every task (runs `tsc && vite build`). `tsconfig.json` has `noUnusedLocals: true` and `noUnusedParameters: true`, so TS will catch most unused-symbol errors. For the Worker, `npx wrangler deploy --dry-run` from `worker/` validates.

**Out of scope (explicitly for the NEXT plan):**
- The actual React Native port (React → RN conversion, replacing `<div>` with `<View>`, etc.).
- Implementing offline-first data layer (IndexedDB/AsyncStorage cache, sync queue, conflict resolution).
- Replacing third-party libs (recharts → victory-native, react-datepicker → RN picker, pdfjs → server-side parse or react-native-pdf).

This plan PREPARES the codebase so the next agent has a much smaller surface to convert.

---

## Phase 0 — Baseline & Findings

### Task 0.1: Verify build is green before any edits

**Files:** none

- [ ] **Step 1: Verify frontend build passes**

Run: `cd /var/home/Grey/Projects/Lotus && npm --prefix frontend ci && npm --prefix frontend run build`
Expected: exits 0, produces `frontend/dist/`. If it fails, STOP and fix the root cause before continuing.

- [ ] **Step 2: Verify worker type-checks**

Run: `cd /var/home/Grey/Projects/Lotus/worker && npm ci && npx tsc --noEmit`
Expected: exits 0, no output. If it fails, STOP.

- [ ] **Step 3: Record starting LOC metric as a sanity baseline**

Run: `cd /var/home/Grey/Projects/Lotus && find frontend/src worker/src -name "*.ts" -o -name "*.tsx" -o -name "*.css" | xargs wc -l | tail -1`
Record the `total` number. At end of plan, expect it to be lower (cleanups outweigh new code).

### Task 0.2: Write the findings / mobile-readiness report

**Files:**
- Create: `docs/code-review-findings-2026-04-23.md`

- [ ] **Step 1: Write the findings document**

This document is the single source of truth that the user reviews. Later phases implement what it catalogues. Write it with this exact structure and content (fill `TBD` ONLY with concrete file:line citations discovered while doing later phases — leave it untouched until a phase completes, then append its findings summary):

```markdown
# Lotus Code Review Findings — 2026-04-23

## Scope
Full review of frontend/ and worker/ per the code-review-cleanup plan.

## Executive Summary
- Duplication: worker/src/invites.ts and workspace-invites.ts are ~90% identical.
- Security: Missing rate limiting on login/TOTP; read-modify-write races on all bulk mutations.
- Mobile: Only one breakpoint (640px); many fixed px dimensions; ~18 static inline style blocks.
- RN portability: 11+ localStorage sites, 15+ window.alert/confirm/prompt sites, 4 recharts components, 1 pdfjs dependency, 1 qrcode component, 1 react-datepicker component.

## Findings by Category

### Dead Code / Unused Imports
(Populated in Phase 1.)

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
```

- [ ] **Step 2: Commit the skeleton**

```bash
git add docs/code-review-findings-2026-04-23.md
git commit -m "docs: add code review findings skeleton"
```

---

## Phase 1 — Dead Code & Unused Imports

### Task 1.1: Remove unused imports across frontend and worker

**Files:**
- Modify: every `.ts` / `.tsx` under `frontend/src/` and `worker/src/` that has an unused import

- [ ] **Step 1: Identify unused imports**

TypeScript's `noUnusedLocals` catches most unused identifiers but not side-effect or type-only imports that look used. Run a build first — any error is a real unused import:

Run: `cd /var/home/Grey/Projects/Lotus && npx --prefix frontend tsc -p frontend --noEmit 2>&1 | grep -E "is declared but|is defined but never used"`
Run: `cd /var/home/Grey/Projects/Lotus/worker && npx tsc --noEmit 2>&1 | grep -E "is declared but|is defined but never used"`

- [ ] **Step 2: Manually scan the known-heavy files**

`noUnusedLocals` may miss imports used only in JSX that is itself dead. Open each of these and verify every top-of-file import is still referenced in the visible code:
- `frontend/src/pages/DataEntry.tsx` (959 lines — most likely to have dross)
- `frontend/src/pages/Dashboard.tsx` (696 lines)
- `frontend/src/pages/Settings.tsx` (470 lines)
- `frontend/src/pages/Login.tsx` (559 lines)
- `frontend/src/components/dashboard/TransactionDrillDown.tsx` (491 lines)
- `worker/src/index.ts` (1223 lines)

For each file, grep each imported symbol: `grep -c "\bSymbolName\b" <file>` — if count is 1 (just the import line), it's unused.

- [ ] **Step 3: Delete unused imports**

Remove with Edit tool. Do NOT rewrite entire import blocks — surgical removals only. If a default + named import share a line and one is unused, keep the line but drop the unused member.

- [ ] **Step 4: Re-run build to confirm nothing broke**

Run: `npm --prefix frontend run build && (cd worker && npx tsc --noEmit)`
Expected: both pass.

- [ ] **Step 5: Append findings to the report**

Edit `docs/code-review-findings-2026-04-23.md` — replace the `### Dead Code / Unused Imports` section placeholder with a list: each removed import as `- frontend/src/path/file.tsx: removed unused import X`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove unused imports across frontend and worker"
```

### Task 1.2: Remove dead code and unused exports

**Files:**
- Modify: various — driven by findings

- [ ] **Step 1: Find unused exports**

For each `export function`, `export const`, `export class` in `frontend/src/utils/`, `frontend/src/hooks/`, `frontend/src/components/` and `worker/src/`, grep for usages outside the defining file:

Run: `grep -rn "export " frontend/src/utils/ frontend/src/hooks/ | grep -E "(function|const|class) "`

For each match, grep the symbol name across the whole project (excluding the defining file). Zero external references + no internal references = dead export.

- [ ] **Step 2: Check the two flagged spots**

- `frontend/src/pages/Dashboard.tsx:137` has an ESLint `exhaustive-deps` disable comment. Verify: does the `useEffect` truly need that disable, or can missing dependencies be added without triggering infinite loops? If the disable is load-bearing (adding deps causes re-runs), leave it and DOCUMENT the reason in a single-line comment replacing the `eslint-disable-line` comment. If it's not needed, restore deps and remove the disable.
- `frontend/src/components/Logo.tsx:12` has `const ASPECT = 180 / 120` used once at line 22. Inline it: replace `const ASPECT = 180 / 120;` with nothing and change `... * ASPECT ...` to `... * (180 / 120) ...` (or compute the literal `1.5`). Skip if ASPECT is referenced elsewhere — re-grep to confirm.

- [ ] **Step 3: Check commented-out code**

Run: `grep -rn "^[[:space:]]*//" frontend/src/ worker/src/ | grep -v "^\s*//\s*\(TODO\|NOTE\|FIXME\|eslint-\|@\)" | wc -l`
Inspect each comment manually — if it's a commented-out block of real code (not documentation), delete it. Keep `TODO:` / `NOTE:` / `FIXME:` comments as-is unless the TODO is stale and resolved.

- [ ] **Step 4: Delete dead symbols**

Remove dead exports and their dependent dead code with Edit. After each removal, re-run build.

- [ ] **Step 5: Verify**

Run: `npm --prefix frontend run build && (cd worker && npx tsc --noEmit)`
Expected: both pass.

- [ ] **Step 6: Append to findings report**

Add removed items under `### Dead Code / Unused Imports` with file:line and description.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: remove dead code and unused exports"
```

---

## Phase 2 — Frontend Duplication Cleanup

### Task 2.1: Consolidate month-name constants

**Files:**
- Create: `frontend/src/utils/dateConstants.ts`
- Modify: `frontend/src/utils/dataProcessing.ts` (remove local `MONTH_NAMES`)
- Modify: `frontend/src/components/DateRangePicker.tsx` (remove local `MONTH_LABELS`)

Context: both files define the same 12-month array. The audit flagged `dataProcessing.ts` line 28 (`MONTH_NAMES`) and `DateRangePicker.tsx` line 16 (`MONTH_LABELS`) as duplicates. Verify the exact constants and line numbers before editing.

- [ ] **Step 1: Read both constants to confirm they're identical**

```
Read dataProcessing.ts lines around 28
Read DateRangePicker.tsx lines around 16
```
If they are actually different (one is full names, one is short), KEEP both and skip to Step 7. Otherwise proceed.

- [ ] **Step 2: Create the shared module**

Write to `frontend/src/utils/dateConstants.ts`:

```typescript
export const MONTH_NAMES_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

export type MonthIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
```

Pick whichever of the two length-forms matches what the existing `MONTH_NAMES` / `MONTH_LABELS` use and export that name too if needed for migration convenience. Only include both forms if both are actually used.

- [ ] **Step 3: Update dataProcessing.ts**

Replace the local `MONTH_NAMES` declaration (around line 28) with an import from `./dateConstants`. Rename at the call sites if the imported name differs.

- [ ] **Step 4: Update DateRangePicker.tsx**

Replace the local `MONTH_LABELS` declaration (around line 16) with an import from `../utils/dateConstants`.

- [ ] **Step 5: Grep for any other month arrays**

Run: `grep -rn -E "'(Jan|January)'" frontend/src/ --include="*.ts" --include="*.tsx"`
If any other file defines its own month array inline, migrate it too.

- [ ] **Step 6: Build**

Run: `npm --prefix frontend run build`
Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/utils/dateConstants.ts frontend/src/utils/dataProcessing.ts frontend/src/components/DateRangePicker.tsx
git commit -m "refactor: consolidate month-name constants into dateConstants.ts"
```

### Task 2.2: Extract `accumulateByPeriod` from buildMonthlyBalance

**Files:**
- Modify: `frontend/src/utils/dataProcessing.ts` (lines ~216-302)

Context: `buildMonthlyBalance()` has two branches (year === -1 all-time; specific year) with near-identical accumulation loops. Read the function first to confirm.

- [ ] **Step 1: Read the current function**

Read `frontend/src/utils/dataProcessing.ts` lines 200–310 to understand both branches.

- [ ] **Step 2: Decide the extraction interface**

If the loops are truly parallel (same accumulator shape, differing only in the key-derivation function and the filter predicate), extract a helper:

```typescript
interface PeriodBucket { income: number; expenses: number; }

function accumulateByPeriod<T extends { date: string; amount: number }>(
  items: T[],
  periodKey: (item: T) => string,
  classify: (item: T) => 'income' | 'expense' | 'skip',
): Map<string, PeriodBucket> {
  const out = new Map<string, PeriodBucket>();
  for (const item of items) {
    const kind = classify(item);
    if (kind === 'skip') continue;
    const key = periodKey(item);
    const bucket = out.get(key) ?? { income: 0, expenses: 0 };
    if (kind === 'income') bucket.income += item.amount;
    else bucket.expenses += item.amount;
    out.set(key, bucket);
  }
  return out;
}
```

Place this helper at the top of the module (below imports). If the real implementation differs (e.g. it counts transactions, splits by category), adapt the shape to fit.

- [ ] **Step 3: Rewrite both branches to call the helper**

The goal: both branches produce the same `Map<string, PeriodBucket>` via `accumulateByPeriod` with different `periodKey` and `classify` callbacks. The downstream rendering code (converting the map to chart data) stays the same.

- [ ] **Step 4: Build and run the dev server manually**

Run: `npm --prefix frontend run build`
Expected: pass.

Also: `npm --prefix frontend run dev` in one terminal, then open the dashboard's Monthly Balance view in a browser and verify numbers match what was there before. (No automated tests exist for this logic — spot-check against a known month.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/dataProcessing.ts
git commit -m "refactor: extract accumulateByPeriod helper in dataProcessing"
```

---

## Phase 3 — Worker Duplication Cleanup

### Task 3.1: Create shared invite primitives module

**Files:**
- Create: `worker/src/invite-primitives.ts`

Context: `worker/src/invites.ts` and `worker/src/workspace-invites.ts` duplicate `hmacSign`, `b64urlEncode*`, key derivation, and the overall CRUD shape. The two differ only in: KV prefix, the purpose-string mixed into the signing key, the record payload shape.

- [ ] **Step 1: Write the shared primitives**

Write to `worker/src/invite-primitives.ts`:

```typescript
import type { KVNamespace } from '@cloudflare/workers-types';

export async function hmacSign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return b64urlEncode(new Uint8Array(sig));
}

export function b64urlEncode(bytes: Uint8Array): string {
  const s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlEncodeStr(s: string): string {
  return b64urlEncode(new TextEncoder().encode(s));
}

export function b64urlDecodeStr(s: string): string {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  return atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
}

export async function deriveDomainKey(jwtSecret: string, purpose: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(jwtSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(purpose));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Per-process cache keyed by purpose so each derivation runs at most once.
const keyCache = new Map<string, Promise<string>>();
export function getDomainKeyCached(jwtSecret: string, purpose: string): Promise<string> {
  const cacheKey = `${purpose}`;
  let p = keyCache.get(cacheKey);
  if (!p) {
    p = deriveDomainKey(jwtSecret, purpose);
    keyCache.set(cacheKey, p);
  }
  return p;
}

export interface InviteCommon {
  expiresAt: number;
  createdAt: number;
  usedBy: string | null;
}

export async function encodeToken(id: string, jwtSecret: string, purpose: string): Promise<string> {
  const key = await getDomainKeyCached(jwtSecret, purpose);
  const sig = await hmacSign(id, key);
  return b64urlEncodeStr(`${id}:${sig}`);
}

export async function decodeAndVerifyToken(
  token: string,
  jwtSecret: string,
  purpose: string,
): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  let decoded: string;
  try { decoded = b64urlDecodeStr(token); } catch { return { ok: false, reason: 'malformed token' }; }
  const colon = decoded.indexOf(':');
  if (colon < 1) return { ok: false, reason: 'malformed token' };
  const id = decoded.slice(0, colon);
  const sig = decoded.slice(colon + 1);
  const key = await getDomainKeyCached(jwtSecret, purpose);
  const expected = await hmacSign(id, key);
  // Constant-time compare
  if (sig.length !== expected.length) return { ok: false, reason: 'invalid signature' };
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return { ok: false, reason: 'invalid signature' };
  return { ok: true, id };
}

export async function readInviteRecord<T extends InviteCommon>(
  kv: KVNamespace,
  kvKey: string,
): Promise<{ ok: true; record: T } | { ok: false; reason: string }> {
  const raw = await kv.get(kvKey);
  if (!raw) return { ok: false, reason: 'invite not found or expired' };
  const record = JSON.parse(raw) as T;
  if (record.usedBy) return { ok: false, reason: 'invite already used' };
  if (record.expiresAt < Math.floor(Date.now() / 1000)) return { ok: false, reason: 'invite expired' };
  return { ok: true, record };
}

export async function markUsed<T extends InviteCommon>(
  kv: KVNamespace,
  kvKey: string,
  username: string,
): Promise<boolean> {
  const raw = await kv.get(kvKey);
  if (!raw) return false;
  const record = JSON.parse(raw) as T;
  record.usedBy = username;
  const ttl = Math.max(60, record.expiresAt - Math.floor(Date.now() / 1000));
  await kv.put(kvKey, JSON.stringify(record), { expirationTtl: ttl });
  return true;
}
```

Note the constant-time compare — this is an improvement over the current code which does plain `!==`. Even though the signatures aren't secret per se, this avoids any future timing-oracle concerns and costs nothing.

- [ ] **Step 2: Type-check**

Run: `cd worker && npx tsc --noEmit`
Expected: pass (the module is standalone at this point).

- [ ] **Step 3: Commit**

```bash
git add worker/src/invite-primitives.ts
git commit -m "refactor(worker): add shared invite-primitives module"
```

### Task 3.2: Rewrite invites.ts on top of primitives

**Files:**
- Modify: `worker/src/invites.ts` (reduce to ~40 lines)

- [ ] **Step 1: Rewrite invites.ts**

Replace the entire file contents with:

```typescript
import type { KVNamespace } from '@cloudflare/workers-types';
import {
  InviteCommon, encodeToken, decodeAndVerifyToken, readInviteRecord, markUsed, hmacSign, getDomainKeyCached, b64urlEncodeStr,
} from './invite-primitives';

export interface InviteRecord extends InviteCommon {}

const PURPOSE = 'invite-token-v1';
const INVITE_TTL_SECONDS = 7 * 24 * 60 * 60;
const kvKey = (id: string) => `invites:${id}`;

export async function createInvite(kv: KVNamespace, jwtSecret: string): Promise<{ id: string; token: string; expiresAt: number }> {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + INVITE_TTL_SECONDS;
  const record: InviteRecord = { expiresAt, createdAt: now, usedBy: null };
  await kv.put(kvKey(id), JSON.stringify(record), { expirationTtl: INVITE_TTL_SECONDS });
  const token = await encodeToken(id, jwtSecret, PURPOSE);
  return { id, token, expiresAt };
}

export async function verifyInvite(kv: KVNamespace, token: string, jwtSecret: string): Promise<{ ok: true; id: string; record: InviteRecord } | { ok: false; reason: string }> {
  const dec = await decodeAndVerifyToken(token, jwtSecret, PURPOSE);
  if (!dec.ok) return dec;
  const read = await readInviteRecord<InviteRecord>(kv, kvKey(dec.id));
  if (!read.ok) return read;
  return { ok: true, id: dec.id, record: read.record };
}

export async function markInviteUsed(kv: KVNamespace, id: string, username: string): Promise<boolean> {
  return markUsed<InviteRecord>(kv, kvKey(id), username);
}

export async function listInvites(kv: KVNamespace, jwtSecret: string): Promise<Array<{ id: string; expiresAt: number; createdAt: number; usedBy: string | null; token: string }>> {
  const list = await kv.list({ prefix: 'invites:' });
  const key = await getDomainKeyCached(jwtSecret, PURPOSE);
  const reads = await Promise.all(list.keys.map(async (k) => {
    const raw = await kv.get(k.name);
    if (!raw) return null;
    const r = JSON.parse(raw) as InviteRecord;
    const id = k.name.slice('invites:'.length);
    const sig = await hmacSign(id, key);
    const token = b64urlEncodeStr(`${id}:${sig}`);
    return { id, ...r, token };
  }));
  return reads.filter((x): x is { id: string; expiresAt: number; createdAt: number; usedBy: string | null; token: string } => x !== null);
}

export async function deleteInvite(kv: KVNamespace, id: string): Promise<void> {
  await kv.delete(kvKey(id));
}
```

- [ ] **Step 2: Type-check**

Run: `cd worker && npx tsc --noEmit`
Expected: pass.

- [ ] **Step 3: Smoke-test by running the dev worker**

Run: `cd worker && npx wrangler dev --local` (in background or a separate terminal).
Without a full integration test, at minimum verify the worker starts without runtime errors.

- [ ] **Step 4: Commit**

```bash
git add worker/src/invites.ts
git commit -m "refactor(worker): rewrite invites.ts on invite-primitives"
```

### Task 3.3: Rewrite workspace-invites.ts on top of primitives

**Files:**
- Modify: `worker/src/workspace-invites.ts` (reduce to ~50 lines)

- [ ] **Step 1: Rewrite workspace-invites.ts**

```typescript
import type { KVNamespace } from '@cloudflare/workers-types';
import {
  InviteCommon, encodeToken, decodeAndVerifyToken, readInviteRecord, markUsed, hmacSign, getDomainKeyCached, b64urlEncodeStr,
} from './invite-primitives';

export interface WorkspaceInviteRecord extends InviteCommon {
  instanceId: string;
  createdBy: string;
}

const PURPOSE = 'workspace-invite-v1';
const TTL_SECONDS = 7 * 24 * 60 * 60;
const kvKey = (id: string) => `workspace-invites:${id}`;

export async function createWorkspaceInvite(
  kv: KVNamespace,
  instanceId: string,
  createdBy: string,
  jwtSecret: string,
): Promise<{ id: string; token: string; expiresAt: number }> {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + TTL_SECONDS;
  const record: WorkspaceInviteRecord = { instanceId, createdBy, expiresAt, createdAt: now, usedBy: null };
  await kv.put(kvKey(id), JSON.stringify(record), { expirationTtl: TTL_SECONDS });
  const token = await encodeToken(id, jwtSecret, PURPOSE);
  return { id, token, expiresAt };
}

export async function verifyWorkspaceInvite(
  kv: KVNamespace,
  token: string,
  jwtSecret: string,
): Promise<{ ok: true; id: string; record: WorkspaceInviteRecord } | { ok: false; reason: string }> {
  const dec = await decodeAndVerifyToken(token, jwtSecret, PURPOSE);
  if (!dec.ok) return dec;
  const read = await readInviteRecord<WorkspaceInviteRecord>(kv, kvKey(dec.id));
  if (!read.ok) return read;
  return { ok: true, id: dec.id, record: read.record };
}

export async function markWorkspaceInviteUsed(kv: KVNamespace, id: string, username: string): Promise<boolean> {
  return markUsed<WorkspaceInviteRecord>(kv, kvKey(id), username);
}

export async function listWorkspaceInvites(
  kv: KVNamespace,
  instanceId: string,
  jwtSecret: string,
): Promise<Array<{ id: string; expiresAt: number; createdAt: number; usedBy: string | null; token: string }>> {
  const list = await kv.list({ prefix: 'workspace-invites:' });
  const key = await getDomainKeyCached(jwtSecret, PURPOSE);
  const reads = await Promise.all(list.keys.map(async (k) => {
    const raw = await kv.get(k.name);
    if (!raw) return null;
    const r = JSON.parse(raw) as WorkspaceInviteRecord;
    if (r.instanceId !== instanceId) return null;
    const id = k.name.slice('workspace-invites:'.length);
    const sig = await hmacSign(id, key);
    const token = b64urlEncodeStr(`${id}:${sig}`);
    return { id, expiresAt: r.expiresAt, createdAt: r.createdAt, usedBy: r.usedBy, token };
  }));
  return reads.filter((x): x is { id: string; expiresAt: number; createdAt: number; usedBy: string | null; token: string } => x !== null);
}

export async function deleteWorkspaceInvite(kv: KVNamespace, id: string): Promise<void> {
  await kv.delete(kvKey(id));
}
```

- [ ] **Step 2: Type-check**

Run: `cd worker && npx tsc --noEmit`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add worker/src/workspace-invites.ts
git commit -m "refactor(worker): rewrite workspace-invites.ts on invite-primitives"
```

### Task 3.4: Extract auth middleware patterns

**Files:**
- Modify: `worker/src/index.ts` around lines 103-135 (the three `authenticate*` functions)

- [ ] **Step 1: Read the current auth functions**

Read `worker/src/index.ts:100-140` to understand `authenticate()`, `authenticateAdmin()`, `authenticateInstanceOwner()` exactly.

- [ ] **Step 2: Evaluate the opportunity**

These three share JWT verification (call `verifyJWT` once) and CORS-aware error responses, but they make different authorization checks after. If the only duplicated code is the `const authHeader = ...; if (!authHeader) return respond(...);` prelude, a single `extractJWT` helper is enough. If there's more duplicated body, extract further.

Implement: a private `requireAuth(request, env, cors): Promise<{ username: string } | Response>` that verifies the JWT and returns either the decoded claims or a 401 Response. Have each `authenticate*` call it first, then layer its own authorization on top.

- [ ] **Step 3: Apply the refactor**

Edit surgically — replace only the duplicated body, keep call sites unchanged.

- [ ] **Step 4: Build**

Run: `cd worker && npx tsc --noEmit`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add worker/src/index.ts
git commit -m "refactor(worker): extract requireAuth helper, consolidate auth middleware"
```

---

## Phase 4 — Extract Hard-Coded Values

### Task 4.1: Create `frontend/src/utils/constants.ts`

**Files:**
- Create: `frontend/src/utils/constants.ts`

- [ ] **Step 1: Write the constants file**

```typescript
// ── UI Timing ────────────────────────────────────────────────────────────
export const TOAST_DEFAULT_DURATION_MS = 5000;
export const TOAST_TICK_INTERVAL_MS = 50;
export const SUCCESS_FLASH_DURATION_MS = 1200;

// ── Drag / Touch ─────────────────────────────────────────────────────────
export const TOUCH_SENSOR_DELAY_MS = 200;
export const TOUCH_SENSOR_TOLERANCE_PX = 5;

// ── Date ranges ──────────────────────────────────────────────────────────
export const YEAR_LOOKBACK = 10;
export const YEAR_LOOKFORWARD = 10;
export const UNIX_MS_MULTIPLIER = 1000;

// ── Auth ─────────────────────────────────────────────────────────────────
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_ADMIN_MIN_LENGTH = 12;
export const USERNAME_REGEX = /^[a-z0-9_-]{3,32}$/;
export const USERNAME_HINT = '3–32 chars; a–z, 0–9, _ or - only';

// ── Charts ───────────────────────────────────────────────────────────────
export const CHART_HEIGHT_PX = 400;
export const CHART_Y_AXIS_HEADROOM = 1.1;
export const CHART_Y_TICK_STEP = 50;

// ── Storage keys ─────────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  TOKEN: 'ft_token',
  USERNAME: 'ft_username',
  ACTIVE_INSTANCE: 'ft_active_instance',
  PENDING_WORKSPACE_INVITE: 'ft_pending_workspace_invite',
  DASHBOARD_ORDER: (instanceId: string) => `ft_dashboard_order_${instanceId}`,
  DASHBOARD_MINIMIZED: (instanceId: string) => `ft_dashboard_minimized_${instanceId}`,
} as const;

// ── Backups ──────────────────────────────────────────────────────────────
export const BACKUP_FILENAME_PREFIX = 'lotus-backup';
```

Note: values like `TOUCH_SENSOR_DELAY_MS = 200` should match what's already in code — verify by reading `Dashboard.tsx:108` and `Settings.tsx:101` first. Same for `CHART_HEIGHT_PX`, `PASSWORD_MIN_LENGTH`, etc. Do NOT invent new values; this file MIRRORS current behavior.

- [ ] **Step 2: Verify values match what's in code**

For each constant, run: `grep -rn "200" frontend/src/pages/Dashboard.tsx frontend/src/pages/Settings.tsx` etc. and cross-check.

- [ ] **Step 3: Type-check**

Run: `npm --prefix frontend run build`
Expected: pass (file is not imported yet but should be valid).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/utils/constants.ts
git commit -m "chore: add frontend constants module"
```

### Task 4.2: Replace magic numbers at call sites

**Files:**
- Modify: `frontend/src/components/Toast.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx`
- Modify: `frontend/src/pages/Settings.tsx`
- Modify: `frontend/src/pages/DataEntry.tsx`
- Modify: `frontend/src/pages/Login.tsx`
- Modify: `frontend/src/components/DateRangePicker.tsx`
- Modify: `frontend/src/components/charts/CategoryLineChart.tsx`
- Modify: `frontend/src/components/DangerZone.tsx`
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/hooks/useDashboardLayout.ts`
- Modify: `frontend/src/pages/WorkspaceInvitePage.tsx`
- Modify: `frontend/src/components/InviteTokensCard.tsx`
- Modify: `frontend/src/components/WorkspacesCard.tsx`

Do these in small commits grouped by constant, not one giant commit.

- [ ] **Step 1: Replace storage keys**

In `api/client.ts`, `hooks/useDashboardLayout.ts`, `pages/WorkspaceInvitePage.tsx`, replace the literal strings `'ft_token'`, `'ft_username'`, `'ft_active_instance'`, `'ft_pending_workspace_invite'` with imports from `STORAGE_KEYS`. The dashboard-per-instance keys currently constructed inline become `STORAGE_KEYS.DASHBOARD_ORDER(instanceId)`.

Verify with: `grep -rn "ft_" frontend/src/ --include="*.ts" --include="*.tsx"`
After the edit, only the import and the `STORAGE_KEYS` object itself should show up.

Commit:
```bash
git add -A
git commit -m "refactor: replace literal storage keys with STORAGE_KEYS constants"
```

- [ ] **Step 2: Replace Unix-timestamp multipliers**

Grep: `grep -rn "\* 1000" frontend/src/ --include="*.ts" --include="*.tsx"`
For each occurrence that's converting unix seconds → ms, replace with `* UNIX_MS_MULTIPLIER`. Don't replace unrelated `* 1000` (e.g. bytes→KB).

Commit:
```bash
git add -A
git commit -m "refactor: use UNIX_MS_MULTIPLIER for seconds→ms conversions"
```

- [ ] **Step 3: Replace timing constants**

- `Toast.tsx`: replace `5000` (default duration) with `TOAST_DEFAULT_DURATION_MS`, replace `50` (tick interval) with `TOAST_TICK_INTERVAL_MS`.
- `DataEntry.tsx` lines 339-342, 371-374, 469-472: replace `1200` with `SUCCESS_FLASH_DURATION_MS`.
- `Dashboard.tsx:108` and `Settings.tsx:101`: replace `delay: 200, tolerance: 5` with `delay: TOUCH_SENSOR_DELAY_MS, tolerance: TOUCH_SENSOR_TOLERANCE_PX`.
- `CategoryLineChart.tsx:194`: replace `400` with `CHART_HEIGHT_PX`.
- `CategoryLineChart.tsx:217`: replace `1.1` and `50` with `CHART_Y_AXIS_HEADROOM` and `CHART_Y_TICK_STEP`.

Commit:
```bash
git add -A
git commit -m "refactor: extract timing and chart magic numbers to constants"
```

- [ ] **Step 4: Replace year-range and auth constants**

- `DateRangePicker.tsx:44`: `viewedYear - 10` / `viewedYear + 10` → `YEAR_LOOKBACK` / `YEAR_LOOKFORWARD`.
- `Dashboard.tsx:408, 550`: `today.getFullYear() - 10` → use `YEAR_LOOKBACK`.
- `Login.tsx:129, 98, 125`: password min-length `8` → `PASSWORD_MIN_LENGTH` (and for admin, `PASSWORD_ADMIN_MIN_LENGTH`). Username regex → `USERNAME_REGEX`.

Commit:
```bash
git add -A
git commit -m "refactor: extract year-range and auth-validation constants"
```

- [ ] **Step 5: Build**

Run: `npm --prefix frontend run build`
Expected: pass.

- [ ] **Step 6: Append to findings**

Record in `docs/code-review-findings-2026-04-23.md` under `### Hard-coded Values` the list of constants extracted and where.

### Task 4.3: Worker-side constants

**Files:**
- Create: `worker/src/constants.ts`
- Modify: `worker/src/index.ts` and others to import

- [ ] **Step 1: Write the worker constants**

```typescript
export const JWT_TTL_SECONDS = 86400 * 7;
export const PREAUTH_TTL_SECONDS = 300;
export const INVITE_TTL_SECONDS = 7 * 24 * 60 * 60;
export const WORKSPACE_INVITE_TTL_SECONDS = 7 * 24 * 60 * 60;

export const MAX_BATCH_SIZE = 1000;       // for bulk POST/PUT/DELETE
export const MAX_BULK_IDS = 10_000;

export const KV_PREFIXES = {
  USER: (username: string, field: string) => `users:${username}:${field}`,
  INSTANCE_META: (id: string) => `instances:${id}:meta`,
  INSTANCE_DATA: (id: string, kind: string) => `instances:${id}:data:${kind}`,
  PREAUTH: (id: string) => `preauth:${id}`,
  RATELIMIT_LOGIN: (username: string) => `ratelimit:login:${username}`,
  RATELIMIT_TOTP: (preauthId: string) => `ratelimit:totp:${preauthId}`,
  AUDIT: (ts: number, id: string) => `audit:${ts}:${id}`,
} as const;
```

- [ ] **Step 2: Migrate inline KV key constructions to use KV_PREFIXES**

In `worker/src/index.ts`, many lines construct keys inline like `users:${username}:profile` or `instances:${id}:meta`. Replace each with the helper. This makes the key schema single-source-of-truth and reduces typo risk.

Grep to find them: `grep -rn "users:\|instances:\|preauth:" worker/src/`

- [ ] **Step 3: Type-check**

Run: `cd worker && npx tsc --noEmit`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add worker/src/constants.ts worker/src/index.ts
git commit -m "refactor(worker): extract TTL constants and KV key helpers"
```

---

## Phase 5 — Security Hardening

### Task 5.1: Add security headers to every response

**Files:**
- Modify: `worker/src/index.ts` — the `respond()` helper

- [ ] **Step 1: Find the respond() function**

Read `worker/src/index.ts` around the top of the file to find the `respond(body, status, headers)` helper.

- [ ] **Step 2: Add security headers**

Modify `respond()` to include these on every response:

```typescript
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

function respond(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...SECURITY_HEADERS,
      ...headers,
    },
  });
}
```

If `respond()` already takes different args, adapt — but always merge SECURITY_HEADERS before the caller-supplied headers so CORS headers can't be stomped.

- [ ] **Step 3: Type-check**

Run: `cd worker && npx tsc --noEmit`
Expected: pass.

- [ ] **Step 4: Smoke test**

Run: `cd worker && npx wrangler dev --local &` then `curl -i http://localhost:8787/api/health 2>/dev/null | head -20` (or any GET endpoint that doesn't require auth — pick an existing one from `index.ts`).
Expected: Response headers include `X-Content-Type-Options: nosniff`.

Stop the dev worker.

- [ ] **Step 5: Commit**

```bash
git add worker/src/index.ts
git commit -m "feat(worker): add default security headers (XCTO, XFO, Referrer-Policy, HSTS)"
```

### Task 5.2: Fix CORS default-to-`*` fallback

**Files:**
- Modify: `worker/src/index.ts` around lines 73-91 (the `corsHeaders()` function)

- [ ] **Step 1: Read current CORS implementation**

Read `worker/src/index.ts:60-100` to see `corsHeaders()`.

- [ ] **Step 2: Change default behavior**

The current code sets `allowOrigin = '*'` as a default. Change to empty string when no match, and rely on `ALLOWED_ORIGIN` + the localhost allow-list. With empty `Access-Control-Allow-Origin`, browsers will reject cross-origin requests — which is the correct behavior when config is missing.

```typescript
function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin');
  const allowedOrigin = env.ALLOWED_ORIGIN ?? '';
  const isLocalhost = !!origin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const matchesAllowed = !!origin && !!allowedOrigin && origin === allowedOrigin;

  let allowOrigin = '';
  if (isLocalhost || matchesAllowed) allowOrigin = origin!;

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}
```

The `Vary: Origin` header is added so CDN caches don't cross-contaminate between origins.

- [ ] **Step 3: Verify ALLOWED_ORIGIN is set in dev**

Read `worker/.dev.vars` and confirm it has `ALLOWED_ORIGIN` set. If not, add `ALLOWED_ORIGIN=http://localhost:5173` or similar.

- [ ] **Step 4: Smoke test locally**

Run the dev worker and test: `curl -i -H "Origin: http://evil.com" http://localhost:8787/api/...`
Expected: `Access-Control-Allow-Origin:` (empty) in the response.

`curl -i -H "Origin: http://localhost:5173" http://localhost:8787/api/...`
Expected: `Access-Control-Allow-Origin: http://localhost:5173`.

- [ ] **Step 5: Commit**

```bash
git add worker/src/index.ts
git commit -m "fix(worker): CORS no longer defaults to '*' when origin doesn't match"
```

### Task 5.3: Rate-limit login and TOTP verification

**Files:**
- Modify: `worker/src/index.ts` around `/api/auth/login` (line ~456) and `/api/auth/verify-2fa` (line ~484)
- Modify: `worker/src/constants.ts`

Context: attacker has unlimited attempts at both endpoints. Cloudflare KV doesn't support atomic increment, but we can use a simple "first fail writes timestamp, subsequent fails increment counter" approach with TTL.

- [ ] **Step 1: Add rate-limit constants**

Add to `worker/src/constants.ts`:

```typescript
export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_SECONDS = 15 * 60;
export const TOTP_MAX_ATTEMPTS = 5;
export const TOTP_LOCKOUT_SECONDS = 60;
```

- [ ] **Step 2: Write a rate-limit helper**

Add near the top of `worker/src/index.ts` (or in a new `worker/src/ratelimit.ts` if you prefer — keep it small either way):

```typescript
interface RateLimitState { count: number; firstAt: number; }

async function checkAndIncrement(
  kv: KVNamespace,
  key: string,
  maxAttempts: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const raw = await kv.get(key);
  const now = Math.floor(Date.now() / 1000);
  let state: RateLimitState;
  if (raw) {
    state = JSON.parse(raw) as RateLimitState;
    if (now - state.firstAt > windowSeconds) {
      // Window expired — reset.
      state = { count: 1, firstAt: now };
    } else {
      state = { count: state.count + 1, firstAt: state.firstAt };
    }
  } else {
    state = { count: 1, firstAt: now };
  }
  const remaining = Math.max(0, windowSeconds - (now - state.firstAt));
  await kv.put(key, JSON.stringify(state), { expirationTtl: Math.max(60, remaining) });
  return { allowed: state.count <= maxAttempts, remaining };
}

async function clearRateLimit(kv: KVNamespace, key: string): Promise<void> {
  await kv.delete(key);
}
```

Important caveat: KV is eventually consistent. Two concurrent attacker requests may both see 0 and both write 1 — that's a known limitation. For 99% of brute-force traffic patterns this still works (attacker serializes requests to the same edge POP). Accept this limitation; document it in a single comment above the helper.

- [ ] **Step 3: Wire into /api/auth/login**

BEFORE the password check in the login handler, call:

```typescript
const rl = await checkAndIncrement(env.FINANCE_KV, KV_PREFIXES.RATELIMIT_LOGIN(username), LOGIN_MAX_ATTEMPTS, LOGIN_LOCKOUT_SECONDS);
if (!rl.allowed) {
  return respond({ error: `Too many attempts. Try again in ${Math.ceil(rl.remaining / 60)} minute(s).` }, 429, cors);
}
```

On successful login, clear the rate-limit key so the user doesn't carry counter state:
```typescript
await clearRateLimit(env.FINANCE_KV, KV_PREFIXES.RATELIMIT_LOGIN(username));
```

Be careful: increment BEFORE the password check so failed attempts count; clear AFTER successful verification.

- [ ] **Step 4: Wire into /api/auth/verify-2fa**

Same pattern, keyed by the preauth ID instead of username (since the username isn't yet disclosed at TOTP step — check what field is available). Use `KV_PREFIXES.RATELIMIT_TOTP(preAuthId)`.

- [ ] **Step 5: Type-check**

Run: `cd worker && npx tsc --noEmit`
Expected: pass.

- [ ] **Step 6: Manual test**

Run dev worker. Hit login with a wrong password 6 times. Expect a 429 on the 6th.

- [ ] **Step 7: Commit**

```bash
git add worker/src/
git commit -m "feat(worker): rate-limit login and TOTP verification"
```

### Task 5.4: Bind setup init→confirm with short-lived token

**Files:**
- Modify: `worker/src/index.ts` around `/api/setup/init` (line ~379) and `/api/setup/confirm` (line ~423)

Context: the init endpoint stores `confirmed: false` on the user profile. Anyone who knows the username can call confirm. Add a 90-second token issued by init, required by confirm.

- [ ] **Step 1: Update /api/setup/init to issue a short-lived token**

Before responding, do:

```typescript
const setupTokenId = crypto.randomUUID();
await env.FINANCE_KV.put(
  `setup-token:${setupTokenId}`,
  JSON.stringify({ username, inviteId: invite.id }),
  { expirationTtl: 90 },
);
// include setupToken in response
return respond({ totpSecret, username, setupToken: setupTokenId }, 200, cors);
```

- [ ] **Step 2: Update /api/setup/confirm to require the token**

```typescript
const { setupToken, username, password, totpCode } = body;
if (!setupToken) return respond({ error: 'Missing setup token.' }, 400, cors);
const tokRaw = await env.FINANCE_KV.get(`setup-token:${setupToken}`);
if (!tokRaw) return respond({ error: 'Setup token expired.' }, 400, cors);
const tok = JSON.parse(tokRaw) as { username: string; inviteId: string };
if (tok.username !== username) return respond({ error: 'Token does not match username.' }, 400, cors);
// delete token on successful confirm (single use)
```

At the end of a successful confirm, delete the setup token.

- [ ] **Step 3: Update frontend Login.tsx to plumb setupToken**

Read `frontend/src/pages/Login.tsx` — find where it calls the init endpoint and then confirm. Pass the new `setupToken` from init into the confirm call.

- [ ] **Step 4: Type-check both**

Run: `npm --prefix frontend run build && (cd worker && npx tsc --noEmit)`
Expected: both pass.

- [ ] **Step 5: Manual end-to-end test**

Run the dev worker + frontend. Walk through an invite → init → confirm flow with a fresh invite. Confirm it still works.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(auth): bind setup init→confirm with short-lived token"
```

### Task 5.5: Bump PBKDF2 iterations and narrow TOTP window

**Files:**
- Modify: `worker/src/crypto.ts`

- [ ] **Step 1: Read crypto.ts**

Read `worker/src/crypto.ts` to confirm iteration count and TOTP window.

- [ ] **Step 2: Decide migration strategy for PBKDF2**

Bumping iterations from 100k → 600k means EXISTING password hashes (stored with 100k) won't verify against a 600k-iteration deriveBits output. There are two approaches:

A) **Store iterations alongside hash.** Change the stored format from `{salt}:{hash}` (or whatever it is now) to `{iterations}:{salt}:{hash}`. On verify, parse the iteration count from the stored record. New hashes written at 600k; old hashes still verify at their stored 100k count. Safe migration.

B) **Force password reset for all users.** Breaks existing users. Not acceptable.

Use approach A. Read the current `hashPassword` / `verifyPassword` functions to see the current serialization format.

- [ ] **Step 3: Implement the format change**

If the current format serializes `${saltHex}:${hashHex}`, change to `${iterations}:${saltHex}:${hashHex}`. In `verifyPassword`, parse by the first `:` — if the first segment parses as a positive integer and looks like an iteration count (100000..10_000_000), use that; otherwise treat the input as legacy and default to 100000.

```typescript
const PBKDF2_ITERATIONS = 600_000;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derive(password, salt, PBKDF2_ITERATIONS);
  return `${PBKDF2_ITERATIONS}:${bytesToHex(salt)}:${bytesToHex(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  let iters: number, saltHex: string, hashHex: string;
  if (parts.length === 3 && /^\d+$/.test(parts[0])) {
    [iters, saltHex, hashHex] = [Number(parts[0]), parts[1], parts[2]];
  } else if (parts.length === 2) {
    [iters, saltHex, hashHex] = [100_000, parts[0], parts[1]]; // legacy
  } else {
    return false;
  }
  if (iters < 100_000 || iters > 10_000_000) return false;
  const salt = hexToBytes(saltHex);
  const bits = await derive(password, salt, iters);
  const computed = bytesToHex(new Uint8Array(bits));
  if (computed.length !== hashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ hashHex.charCodeAt(i);
  return diff === 0;
}
```

Adapt to the actual existing function shape — don't rewrite wholesale; edit surgically.

- [ ] **Step 4: Narrow TOTP window**

Change `verifyTOTP`:

```typescript
export async function verifyTOTP(secret: string, code: string): Promise<boolean> {
  for (const offset of [-1, 0]) {  // was [-1, 0, 1]
    if ((await getTOTP(secret, offset)) === code) return true;
  }
  return false;
}
```

Rationale: dropping `+1` accepts only the current step and the most-recent previous step. Paired with rate limiting from Task 5.3, this forces an attacker to guess 1M codes in 60 seconds at max 5 attempts = infeasible.

- [ ] **Step 5: Type-check**

Run: `cd worker && npx tsc --noEmit`
Expected: pass.

- [ ] **Step 6: Manual login test with existing credentials**

Run dev worker, log in with an existing user. Verify it still works (confirms legacy 100k hashes still verify). Then create a new user and verify that account's stored hash starts with `600000:`.

- [ ] **Step 7: Commit**

```bash
git add worker/src/crypto.ts
git commit -m "feat(crypto): bump PBKDF2 to 600k iterations, narrow TOTP window"
```

### Task 5.6: Fix invite-metadata membership leak

**Files:**
- Modify: `worker/src/index.ts` around `/api/instances/invites/meta` (line ~708)

- [ ] **Step 1: Add membership guard**

After verifying the invite token and loading instance metadata, return minimal info only. Specifically, do NOT return the `members` array to a non-member; only include a boolean `alreadyMember`. Inspect the current response body and remove any full member listings:

```typescript
return respond({
  instanceName: inst.name,
  ownerUsername: inst.owner,
  expiresAt: record.expiresAt,
  alreadyMember: inst.members.includes(auth.username),
  // REMOVED: full members array
}, 200, cors);
```

- [ ] **Step 2: Audit frontend to see if it used `members`**

Run: `grep -rn "invites/meta\|inviteMeta" frontend/src/`
If any component consumed `members` from this response, remove that usage — the existence of `alreadyMember` is sufficient.

- [ ] **Step 3: Type-check**

Run: `npm --prefix frontend run build && (cd worker && npx tsc --noEmit)`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix(worker): drop members array from /instances/invites/meta response"
```

### Task 5.7: Add JSON body size caps

**Files:**
- Modify: `worker/src/index.ts` — every endpoint that does `await request.json()` on an array-typed field

- [ ] **Step 1: Grep for batch-style endpoints**

Run: `grep -n "request.json" worker/src/index.ts`
For each hit, read 5 lines of context. Flag any that assign an array into the body (`transactions`, `transactionIds`, `incomeIds`, `mappings`, etc.).

- [ ] **Step 2: Add caps**

For each array field, add a length check immediately after JSON parsing:

```typescript
if (body.transactions && body.transactions.length > MAX_BATCH_SIZE) {
  return respond({ error: `Batch exceeds maximum of ${MAX_BATCH_SIZE}.` }, 413, cors);
}
```

Use `MAX_BATCH_SIZE` for the "content items" arrays and `MAX_BULK_IDS` for ID-only arrays (since IDs are small and more can fit safely).

- [ ] **Step 3: Type-check and commit**

Run: `cd worker && npx tsc --noEmit`
Expected: pass.

```bash
git add worker/src/index.ts
git commit -m "feat(worker): cap JSON batch sizes to prevent memory exhaustion"
```

### Task 5.8: Append security-phase findings

- [ ] **Step 1: Append to findings report**

Edit `docs/code-review-findings-2026-04-23.md` — replace the `### Security` placeholder with the list of fixes applied and the cross-referenced file:line.

- [ ] **Step 2: Commit**

```bash
git add docs/code-review-findings-2026-04-23.md
git commit -m "docs: record security-review findings"
```

---

## Phase 6 — Concurrency / Data Integrity

### Task 6.1: Add optimistic-concurrency versioning to instance data

**Files:**
- Modify: `worker/src/paginated.ts`
- Modify: `worker/src/index.ts` — every read-modify-write sequence on transactions/income/instance metadata

Context: two tabs editing transactions race and last-write-wins silently. Fix with a per-resource version counter that every read returns and every write requires.

- [ ] **Step 1: Understand the current storage layout**

Read `worker/src/paginated.ts` fully to see how `getTransactions`, `saveTransactions`, `upsertInYear`, `writeAllYears` work today.

- [ ] **Step 2: Add a version field to the index**

The year-index currently stores `{ years: number[] }`. Change to `{ years: number[]; version: number }`. On every write to the index (`upsertInYear`, `writeAllYears`, delete), increment `version`. New writes that include an `If-Match` expectation check against `version` and reject 412 if they don't match.

Since this is a user-facing behavior change (clients need to send the version), implement it gradually: step 2a stores the field, step 2b returns it in responses, step 2c starts requiring it on mutations. Each step is a commit.

- [ ] **Step 3: Return the version from read endpoints**

On `GET /api/transactions`, include `version` in the response envelope:
```typescript
{ transactions: [...], version: 42 }
```
Same for `GET /api/income`.

Frontend (`api/client.ts`) should parse and track this per-resource version.

- [ ] **Step 4: Require the version on write endpoints**

For `POST /api/transactions`, `POST /api/bulk-delete`, `PUT /api/transactions/bulk-update-category`, etc., read `expectedVersion` from the request body. Load the current version, compare, and 409/412 if mismatch. On success, increment and persist.

Because this is behavior-changing, the frontend must send the version. Stage it so write endpoints accept a MISSING `expectedVersion` temporarily (logging a warning) and reject when present-but-stale. Then after the frontend is updated, make it required.

- [ ] **Step 5: Update frontend mutations**

In `frontend/src/api/client.ts`, the data-fetch functions should return a tuple or attach a version attribute to the cached response. The mutation functions should pass it back via `expectedVersion`. On 409, the UI should refetch and ask the user to retry.

This is a multi-file change — stage it carefully. Break this step into sub-commits: 6.4a "return version", 6.4b "send version", 6.4c "require version".

- [ ] **Step 6: Smoke test**

Open the dashboard in two tabs. Edit a category in tab A, then edit a category in tab B without refreshing. Expect tab B to surface a "data has changed — refresh and try again" error.

- [ ] **Step 7: Commit**

Use small commits per sub-step. A final commit:

```bash
git add -A
git commit -m "feat(data): add optimistic-concurrency versioning to transactions and income"
```

### Task 6.2: Harden workspace-member updates

**Files:**
- Modify: `worker/src/index.ts` (lines 625-680 area — member add/remove, instance delete)

Same approach as Task 6.1 but keyed by the instance metadata's `version`. Lower priority than data mutations but same pattern. Apply if time permits; leave clearly-marked TODO in the code with `SECURITY-NOTE: race condition on concurrent member edits — see docs/code-review-findings-2026-04-23.md Phase 6.` and continue.

- [ ] **Step 1–3: Mirror Task 6.1 for instance metadata**

- [ ] **Step 4: Commit**

```bash
git add worker/src/index.ts
git commit -m "feat(workspace): versioning on instance membership edits"
```

### Task 6.3: Fix paginated-index consistency order

**Files:**
- Modify: `worker/src/paginated.ts` — `upsertInYear` (line ~66)

- [ ] **Step 1: Read current order**

In the current code, the shard is written first, then the index. Invert so the index is written first — the index then becomes a superset (safe on partial failures).

- [ ] **Step 2: Swap write order**

Move the `await kv.put(\`${prefix}:index\`, ...)` block ABOVE the `await kv.put(key, ...)` for the shard.

- [ ] **Step 3: Type-check and commit**

Run: `cd worker && npx tsc --noEmit`
Expected: pass.

```bash
git add worker/src/paginated.ts
git commit -m "fix(worker): write paginated index before shard for crash-safety"
```

### Task 6.4: Append concurrency findings

- [ ] **Step 1: Append to findings report**

Edit `docs/code-review-findings-2026-04-23.md` — populate `### Concurrency / Data Integrity` with what was fixed.

- [ ] **Step 2: Commit**

```bash
git add docs/code-review-findings-2026-04-23.md
git commit -m "docs: record concurrency findings"
```

---

## Phase 7 — CSS Design Tokens

### Task 7.1: Add spacing, typography, and z-index tokens

**Files:**
- Modify: `frontend/src/index.css` (top `:root` block, lines 4-30)

- [ ] **Step 1: Read the current :root block**

Read `frontend/src/index.css` lines 1-40.

- [ ] **Step 2: Extend :root with new token scales**

Add BELOW the existing `--radius-*` tokens (keep colors and radius intact):

```css
  /* ─── Spacing scale (rem-based, scales with root font) ─────────────── */
  --space-0: 0;
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.25rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-10: 2.5rem;
  --space-12: 3rem;

  /* ─── Typography scale ─────────────────────────────────────────────── */
  --font-size-xs: 0.75rem;    /* 12px @ 16px base; 10.5px @ 14px base */
  --font-size-sm: 0.875rem;
  --font-size-md: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
  --font-size-3xl: 1.875rem;

  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* ─── Layer scale (z-index) ────────────────────────────────────────── */
  --z-base: 1;
  --z-sticky: 100;
  --z-dropdown: 200;
  --z-modal-backdrop: 500;
  --z-modal: 501;
  --z-toast: 900;
  --z-tooltip: 1000;

  /* ─── Touch target minimums (mobile) ───────────────────────────────── */
  --touch-target-min: 44px;
  --touch-target-compact: 40px;
```

Also bump the base font-size from `14px` to `16px` (line 32). This is the conventional web default and gives us 16px-based rem math. If the user prefers the current 14px visual density, we can apply a per-page `body { font-size: 0.875rem; }` override later, but at the `:root` level 16px is correct.

- [ ] **Step 3: Build and visually verify**

Run: `npm --prefix frontend run build`
Expected: pass.

Manually open the dev server (`npm --prefix frontend run dev`) and confirm the app still renders. Expect text to look SLIGHTLY larger because of the 14→16px base change. This is intentional; later tasks compensate with responsive adjustments.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(css): add spacing, typography, z-index, and touch-target tokens"
```

### Task 7.2: Migrate existing CSS rules to use the new tokens

**Files:**
- Modify: `frontend/src/index.css` — sweep through all 956 lines

This is iterative. Do it in small commits so each is reviewable.

- [ ] **Step 1: Replace z-index magic numbers**

Grep: `grep -n "z-index" frontend/src/index.css`
For each: replace literal `z-index: 100` etc. with `z-index: var(--z-sticky)` (or whichever layer token matches the intent). Use your judgement: `100` is usually sticky or dropdown; `200`/`300` is usually modal; `1000+` is usually tooltip/toast.

Commit:
```bash
git add frontend/src/index.css
git commit -m "refactor(css): migrate z-index values to layer tokens"
```

- [ ] **Step 2: Replace padding/margin with spacing tokens**

Grep for padding/margin in px: `grep -nE "(padding|margin|gap):" frontend/src/index.css | grep -E "[0-9]+px"`
For each rule, replace with the closest spacing-scale token. Examples:
- `padding: 8px 16px;` → `padding: var(--space-2) var(--space-4);`
- `margin-bottom: 24px;` → `margin-bottom: var(--space-6);`
- `gap: 10px;` → `gap: var(--space-2);` (closest 8px) or `gap: var(--space-3);` (12px) depending on visual intent
- `padding: 40px 24px;` (drop-zone) → keep as `padding: clamp(var(--space-6), 5vw, var(--space-10)) var(--space-6);` (uses clamp for mobile-friendliness — will be fully addressed in Phase 9, but convert to tokens now).

Do NOT change pixel values that are genuinely "hairline" — `1px`, `2px` borders, `3px` scrollbar radius, `6px` progress-bar-track height — these are visual details that look identical on mobile as on desktop. Leave them as-is with a trailing comment `/* hairline — keep px */` if questioned.

Work in batches of ~50 lines per commit so each is reviewable.

Commit (example):
```bash
git add frontend/src/index.css
git commit -m "refactor(css): migrate layout padding/margin to --space-* tokens"
```

- [ ] **Step 3: Replace font-size px with typography tokens**

Grep: `grep -nE "font-size:" frontend/src/index.css`
Replace literal values:
- `font-size: 12px` → `var(--font-size-xs)`
- `font-size: 14px` → `var(--font-size-sm)` (though since base is now 16px, this is slightly smaller)
- `font-size: 16px` → `var(--font-size-md)`

If you find font-sizes that already use rem (e.g. `1.25rem`), leave them OR replace with the matching token for consistency — judgement call.

Commit:
```bash
git add frontend/src/index.css
git commit -m "refactor(css): migrate font-size values to typography tokens"
```

- [ ] **Step 4: Verify with eye-test**

Run the dev server. Click through Login → Dashboard → Data Entry → Settings. The visual should be recognizable; spacing should feel equivalent (maybe slightly different due to 14→16 base but that gets addressed). Do NOT proceed if layouts are visibly broken.

- [ ] **Step 5: Append findings**

In `docs/code-review-findings-2026-04-23.md`, under `### CSS / Responsive Units`, list which selectors were converted and any selectors where you made judgement calls (e.g. "`.drop-zone` uses clamp() for responsive padding").

---

## Phase 8 — Fix Inline Styles

### Task 8.1: Move static inline styles in Layout.tsx to CSS

**Files:**
- Modify: `frontend/src/components/layout/Layout.tsx` lines 61, 68, 70
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Add CSS classes**

In `index.css` (find the Layout section or add near the navbar styles):

```css
.navbar-user {
  color: var(--text-primary);
  font-size: var(--font-size-sm);
}

.main-content-wrapper {
  display: flex;
  flex: 1;
  min-height: calc(100vh - 56px);
}

.main-content-inner {
  flex: 1;
  padding: var(--space-8) 0;
  min-width: 0;
}
```

- [ ] **Step 2: Replace inline styles in Layout.tsx**

Change line 61 from:
```tsx
<span style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>
```
to:
```tsx
<span className="navbar-user">
```

Change line 68 from:
```tsx
<div style={{ display: 'flex', flex: 1, minHeight: 'calc(100vh - 56px)' }}>
```
to:
```tsx
<div className="main-content-wrapper">
```

Change line 70 from:
```tsx
<main style={{ flex: 1, padding: '32px 0', minWidth: 0 }}>
```
to:
```tsx
<main className="main-content-inner">
```

- [ ] **Step 3: Build**

Run: `npm --prefix frontend run build`
Expected: pass.

- [ ] **Step 4: Visual test**

Run dev server, verify navbar and layout still look right.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/Layout.tsx frontend/src/index.css
git commit -m "refactor(layout): move static inline styles to CSS classes"
```

### Task 8.2: Move DashboardCard static styles

**Files:**
- Modify: `frontend/src/components/dashboard/DashboardCard.tsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Read DashboardCard.tsx and identify which inline styles are static**

Read the file. Per the audit, lines 52, 76, 80, 82, 103 are STATIC. Lines 35-41, 48-50, 60-74, 89-101 are DYNAMIC (depend on `isDragging`, `minimized`, drag handle state) — keep inline.

- [ ] **Step 2: Add CSS classes**

In `index.css`:

```css
.dashboard-card-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.dashboard-card-title {
  margin: 0;
  min-width: 0;
}

.dashboard-card-actions {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.dashboard-card-drag-icon {
  font-size: var(--font-size-xl);
}

.dashboard-card-minimize-icon {
  font-size: var(--font-size-xl);
}
```

- [ ] **Step 3: Extract inline → classes in the JSX**

For each of the 5 static inline-style locations in DashboardCard, replace with `className=`. Keep dynamic `style={{ ... }}` intact (transform, opacity, zIndex, cursor — driven by drag state or minimized flag).

- [ ] **Step 4: Build and visually test**

Run: `npm --prefix frontend run build`
Expected: pass.

Run the dev server, go to Dashboard, drag a card, minimize a card. Expect behavior unchanged.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/dashboard/DashboardCard.tsx frontend/src/index.css
git commit -m "refactor(dashboard-card): extract static inline styles to CSS"
```

### Task 8.3: Move DataEntry static styles

**Files:**
- Modify: `frontend/src/pages/DataEntry.tsx` lines ~522-557 (and any other static inline styles in the file)
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Identify static inline styles**

Grep within DataEntry.tsx: `grep -n "style={" frontend/src/pages/DataEntry.tsx`
For each hit, read 3 lines of context to judge static vs dynamic. Static ones (per audit) are around lines 522-526 (form header), 530 (card margin), 553, 557 (flex utilities).

- [ ] **Step 2: Add CSS classes**

Name them to fit the existing CSS naming scheme (`.form-header`, `.card-spaced`, `.alert-icon`, etc.). Keep dynamic styles inline.

- [ ] **Step 3: Replace in JSX**

Surgical edits.

- [ ] **Step 4: Build and test**

Run the dev server, walk through the Enter Data flow (CSV upload, manual expense, income entry) — confirm no visual regressions.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/DataEntry.tsx frontend/src/index.css
git commit -m "refactor(data-entry): extract static inline styles to CSS"
```

### Task 8.4: Append inline-styles findings

- [ ] **Step 1: Update findings doc**

In `docs/code-review-findings-2026-04-23.md`, populate `### Inline Styles` with: all files audited, which were moved, which were left (with reason — e.g. "CheckmarkToggle: styles depend on `active`/`themeColor`/`size` props — KEPT inline").

- [ ] **Step 2: Commit**

```bash
git add docs/code-review-findings-2026-04-23.md
git commit -m "docs: record inline-styles review findings"
```

---

## Phase 9 — Responsive Breakpoints & Mobile CSS

### Task 9.1: Restructure media queries to mobile-first

**Files:**
- Modify: `frontend/src/index.css` — the `@media (max-width: 640px)` block (line ~473) and add new breakpoints

Context: currently only one breakpoint exists. Add a tablet breakpoint and restructure selected rules mobile-first.

- [ ] **Step 1: Decide the breakpoint set**

Adopt these three breakpoints (align with Tailwind/Chakra/Bootstrap industry defaults):
- **mobile**: default (0px–639px) — styles are the BASE
- **tablet**: `@media (min-width: 640px)` — medium adjustments
- **desktop**: `@media (min-width: 1024px)` — full-width layout

Retain the existing `(max-width: 640px)` block for now. We will gradually flip rules.

- [ ] **Step 2: Flip the sidebar rule**

`.workspace-tabs { width: 150px; ... }` is currently always visible except the mobile override. Change to mobile-first: hide by default, show on tablet+:

```css
.workspace-tabs {
  display: none;
}
@media (min-width: 640px) {
  .workspace-tabs {
    display: block;
    width: 150px;
    flex-shrink: 0;
    padding: var(--space-4) 0;
  }
}
```

- [ ] **Step 3: Make container padding fluid**

```css
.container {
  max-width: 1280px;
  padding: 0 clamp(var(--space-3), 4vw, var(--space-6));
  margin: 0 auto;
}
```

- [ ] **Step 4: Make modal padding fluid**

```css
.modal-backdrop {
  padding: clamp(var(--space-4), 8vw, var(--space-12)) var(--space-4);
}
.modal-card {
  padding: clamp(var(--space-6), 5vw, var(--space-10));
  max-width: min(90vw, 900px);
  width: 100%;
}
```

- [ ] **Step 5: Build + visual regression test**

Run: `npm --prefix frontend run build`
Expected: pass.

Run the dev server. Open Chrome DevTools. Toggle device toolbar. Test at widths: 360px (iPhone SE), 768px (iPad portrait), 1280px (desktop). Verify:
- 360px: Sidebar hidden. Container padding minimal. Modal fits with ~1rem padding.
- 768px: Sidebar visible at 150px. Container padding moderate.
- 1280px: Sidebar visible. Container padded at its max.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/index.css
git commit -m "refactor(css): mobile-first breakpoints, fluid container and modal padding"
```

### Task 9.2: Touch-target sizing

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Enforce minimum touch targets**

Add to `.btn`, `.btn-sm`, `.nav-link`, `.tab`:

```css
.btn {
  min-height: var(--touch-target-min);
  padding: var(--space-2) var(--space-4);
  /* existing other properties */
}
.btn-sm {
  min-height: var(--touch-target-compact);
  padding: var(--space-2) var(--space-3);
}
.nav-link {
  min-height: var(--touch-target-min);
  display: inline-flex;
  align-items: center;
  padding: var(--space-2) var(--space-3);
}
.tab {
  min-height: var(--touch-target-min);
  padding: var(--space-2) var(--space-3);
  display: inline-flex;
  align-items: center;
}
```

Locate these rules by grepping `grep -n "^\.btn\|^\.tab\|^\.nav-link" frontend/src/index.css` and modify in-place rather than duplicating.

- [ ] **Step 2: Size tiny buttons (drag handle, modal close, toggle)**

`DashboardCard.tsx:64-65` has `width: 32, height: 32` inline on the drag handle. Increase to 44x44 or keep 32 but add padding. Decide: the button's icon is visually small; enlarging the click area without enlarging the icon is the best compromise. Use `min-width: 44px; min-height: 44px; padding: 6px;` so the visible icon stays 32px-ish but the tap surface is 44px.

If this style is inline-dynamic (cursor is dynamic), keep the dynamic cursor inline; extract the sizing to the `.dashboard-card-drag-handle` class added in Task 8.2.

- [ ] **Step 3: Visual smoke test on mobile viewport**

Run the dev server at 360px viewport. Verify buttons are comfortably tappable (no overlap). Dashboard card drag handles should be easy to thumb-hit.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css frontend/src/components/dashboard/DashboardCard.tsx
git commit -m "feat(a11y): enforce 44px touch-target minimum on buttons, tabs, nav links"
```

### Task 9.3: Fluid typography

**Files:**
- Modify: `frontend/src/index.css` — the h1/h2/h3/p block (lines ~42-48)

- [ ] **Step 1: Adopt clamp for major headings**

```css
h1 {
  font-size: clamp(var(--font-size-2xl), 4vw, var(--font-size-3xl));
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.025em;
}
h2 {
  font-size: clamp(var(--font-size-lg), 2.5vw, var(--font-size-xl));
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.015em;
}
h3 {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}
```

- [ ] **Step 2: Build + test**

Run the dev server, verify headings scale nicely at 360px / 768px / 1280px widths.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(css): fluid typography via clamp() for h1 and h2"
```

### Task 9.4: Append CSS / responsive findings

- [ ] **Step 1: Update findings doc**

In `docs/code-review-findings-2026-04-23.md`, expand `### CSS / Responsive Units` with summary of breakpoint changes, fluid rules added, and remaining px values (hairlines) with rationale.

- [ ] **Step 2: Commit**

```bash
git add docs/code-review-findings-2026-04-23.md
git commit -m "docs: record responsive-CSS findings"
```

---

## Phase 10 — Resource Leaks & Error Handling

### Task 10.1: Fix setTimeout cleanup in DataEntry

**Files:**
- Modify: `frontend/src/pages/DataEntry.tsx` around lines 339-342, 371-374, 469-472

Context: three `setTimeout(() => onRequestClose(), 1200)` calls fire their callbacks even after unmount, potentially calling a function on an unmounted component. Wrap each in a useRef pattern.

- [ ] **Step 1: Read the current shape**

Read DataEntry.tsx around each timeout site (lines 330-350, 365-380, 460-480) to see the callback and its closure.

- [ ] **Step 2: Add an unmount guard**

At the component top, add:

```typescript
const isMountedRef = useRef(true);
useEffect(() => () => { isMountedRef.current = false; }, []);
```

Then wrap each timeout body:

```typescript
setTimeout(() => {
  if (!isMountedRef.current) return;
  onRequestClose();
}, SUCCESS_FLASH_DURATION_MS);
```

Even better: store the timeout handle in a ref and clear it on unmount. Pick whichever pattern is cleaner for each specific callback.

- [ ] **Step 3: Build**

Run: `npm --prefix frontend run build`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/DataEntry.tsx
git commit -m "fix(data-entry): guard setTimeout callbacks against unmount"
```

### Task 10.2: Toast unmount safety

**Files:**
- Modify: `frontend/src/components/Toast.tsx`

- [ ] **Step 1: Review the current cleanup**

Read Toast.tsx fully. The `setInterval` cleanup is correct but if `onDismiss` triggers a setState on the parent after unmount, it leaks. Add a guard or `useRef`.

- [ ] **Step 2: Add unmount guard**

Wrap the `onDismiss` call similarly:

```typescript
const mountedRef = useRef(true);
useEffect(() => () => { mountedRef.current = false; }, []);
// inside the tick: if (!mountedRef.current) return;
// before calling onDismiss: if (!mountedRef.current) return;
```

Also memoize the `onDismiss` dependency: wrap the passed-in callback in `useCallback` at the call site (parent components), or compare refs.

Simpler and sufficient: pass `onDismiss` through a ref inside Toast:

```typescript
const onDismissRef = useRef(onDismiss);
useEffect(() => { onDismissRef.current = onDismiss; }, [onDismiss]);
// The interval's dep array omits onDismiss; it reads via the ref.
```

- [ ] **Step 3: Build and test**

Run: `npm --prefix frontend run build`
Expected: pass.

Manually trigger a toast (any action that shows one — in dev, most actions that return successfully fire toasts).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Toast.tsx
git commit -m "fix(toast): unmount-safe onDismiss invocation"
```

### Task 10.3: Surface swallowed errors to users

**Files:**
- Modify: `frontend/src/hooks/useUserCategories.ts` (error swallowing at line ~34)
- Modify: `frontend/src/pages/Settings.tsx` (silent catch in refreshTransactions)
- Modify: `frontend/src/hooks/useWorkspaces.ts` (silent error in instance refresh)
- Modify: `frontend/src/pages/DataEntry.tsx:104` (catch that disables dedup)

Context: four places silently `console.error` and continue. Users never see "your save failed" or "dedup disabled due to network failure." Route these through a Toast.

- [ ] **Step 1: Add a global toast queue**

If one doesn't exist, add a minimal global toast-dispatch utility — check `components/Toast.tsx` for whether it's portal-mounted globally or per-component. If per-component, wire a small context provider so any code can call `toast.error('Failed to save categories')`.

Read `Toast.tsx` and `App.tsx` to see how toasts are currently shown.

- [ ] **Step 2: Replace `console.error` in `useUserCategories.ts`**

Change:
```typescript
saveUserCategories(userCategories).catch((err) => {
  console.error('Failed to save user categories', err);
});
```
to:
```typescript
saveUserCategories(userCategories).catch((err) => {
  console.error('Failed to save user categories', err);
  toast.error('Failed to save category changes. Your edits may not persist.');
});
```

- [ ] **Step 3: Same treatment for the other three sites**

- `Settings.tsx` refresh failure → `toast.error('Could not refresh data. Some figures may be stale.')`
- `useWorkspaces.ts` instance refresh → `toast.warning('Could not refresh workspaces.')`
- `DataEntry.tsx:104` dedup lookup failure → `toast.warning('Duplicate detection unavailable — new rows may overlap with existing ones.')`

- [ ] **Step 4: Build and test**

Run: `npm --prefix frontend run build`
Expected: pass.

Open the dev app with the network tab throttled to offline. Trigger each path. Confirm a toast appears.

- [ ] **Step 5: Append findings**

Update `docs/code-review-findings-2026-04-23.md` — populate `### Error Handling` with the four sites fixed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "fix(errors): surface previously-swallowed errors via toast"
```

### Task 10.4: Append resource-leak findings

- [ ] **Step 1: Update findings doc**

In `docs/code-review-findings-2026-04-23.md`, populate `### Resource Leaks` with each site audited, whether a leak was fixed, and remaining minor concerns.

- [ ] **Step 2: Commit**

```bash
git add docs/code-review-findings-2026-04-23.md
git commit -m "docs: record resource-leak findings"
```

---

## Phase 11 — Storage & Dialog Abstractions (RN Prep)

Goal: stop spraying `localStorage` and `window.alert/confirm/prompt` across the codebase. Put them behind thin wrappers so the RN port can swap implementations in one place.

### Task 11.1: Create `storage.ts` wrapper

**Files:**
- Create: `frontend/src/utils/storage.ts`
- Modify: every file that currently reads/writes localStorage

- [ ] **Step 1: Write the wrapper**

```typescript
// Thin abstraction over browser storage so RN port can swap to AsyncStorage.
// All methods are intentionally synchronous (matching localStorage) —
// if/when this is ported to RN the surface becomes async and all callers
// get updated at once.

export const storage = {
  get(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch { /* quota/private-mode */ }
  },
  remove(key: string): void {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },
  subscribe(cb: (ev: StorageEvent) => void): () => void {
    window.addEventListener('storage', cb);
    return () => window.removeEventListener('storage', cb);
  },
};

export const sessionStore = {
  get(key: string): string | null {
    try { return sessionStorage.getItem(key); } catch { return null; }
  },
  set(key: string, value: string): void {
    try { sessionStorage.setItem(key, value); } catch { /* ignore */ }
  },
  remove(key: string): void {
    try { sessionStorage.removeItem(key); } catch { /* ignore */ }
  },
};
```

- [ ] **Step 2: Find every localStorage/sessionStorage usage**

Run: `grep -rn "localStorage\.\|sessionStorage\." frontend/src/ --include="*.ts" --include="*.tsx"`

Per the audit, 11+ localStorage sites plus 2 sessionStorage sites.

- [ ] **Step 3: Migrate call sites**

In `frontend/src/api/client.ts`, `frontend/src/hooks/useDashboardLayout.ts`, `frontend/src/hooks/useCurrentUser.ts`, `frontend/src/pages/WorkspaceInvitePage.tsx`, and any others, replace:
- `localStorage.getItem(X)` → `storage.get(X)`
- `localStorage.setItem(X, v)` → `storage.set(X, v)`
- `localStorage.removeItem(X)` → `storage.remove(X)`
- `window.addEventListener('storage', cb)` → `storage.subscribe(cb)`
- `sessionStorage.*` → `sessionStore.*`

- [ ] **Step 4: Verify no direct usages remain**

Run: `grep -rn "localStorage\.\|sessionStorage\." frontend/src/ --include="*.ts" --include="*.tsx"`
Expected: only `storage.ts` contains them. If any file imports but forgets to convert, find and fix.

- [ ] **Step 5: Build**

Run: `npm --prefix frontend run build`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: wrap all localStorage/sessionStorage access in storage module"
```

### Task 11.2: Create `dialog.ts` wrapper

**Files:**
- Create: `frontend/src/utils/dialog.ts`
- Modify: every file calling `window.alert/confirm/prompt`

- [ ] **Step 1: Write the wrapper**

For now, implement as thin browser wrappers; the wrapper is the hook to swap to a React-native Alert or a native in-app modal later.

```typescript
export const dialog = {
  alert(message: string): Promise<void> {
    window.alert(message);
    return Promise.resolve();
  },
  confirm(message: string): Promise<boolean> {
    return Promise.resolve(window.confirm(message));
  },
  prompt(message: string, defaultValue?: string): Promise<string | null> {
    return Promise.resolve(window.prompt(message, defaultValue));
  },
};
```

Make the signatures async-returning even though the current implementation is synchronous — that way the RN port can swap to an async Alert without touching call sites.

- [ ] **Step 2: Find every usage**

Run: `grep -rn "window\.alert\|window\.confirm\|window\.prompt\|^[^/]*\balert(\|^[^/]*\bconfirm(\|^[^/]*\bprompt(" frontend/src/ --include="*.ts" --include="*.tsx"`

Per the audit: Dashboard.tsx (5x alert), Settings.tsx (4x mixed), DataEntry.tsx (2x), WorkspacesCard.tsx (8x mixed), InviteTokensCard.tsx (1x confirm), and more.

- [ ] **Step 3: Migrate call sites**

For each:
- `window.alert(msg)` → `await dialog.alert(msg);` (function must be async)
- `window.confirm(msg)` → `const ok = await dialog.confirm(msg); if (ok) { ... }`
- `window.prompt(msg)` → `const name = await dialog.prompt(msg);`

Wrap call sites in `async` handlers if they aren't already.

- [ ] **Step 4: Verify no direct usages**

Run: `grep -rn "window\.alert\|window\.confirm\|window\.prompt" frontend/src/ --include="*.tsx" --include="*.ts"`
Expected: only `dialog.ts`.

- [ ] **Step 5: Build and manual test**

Run: `npm --prefix frontend run build`
Expected: pass.

Trigger each dialog-bearing action in the dev app. Since `dialog.confirm` is still `window.confirm` under the hood, behavior is unchanged — this step just confirms no callers are broken.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: wrap all window.alert/confirm/prompt in dialog module"
```

### Task 11.3: Create `download.ts` wrapper

**Files:**
- Create: `frontend/src/utils/download.ts`
- Modify: `frontend/src/components/DangerZone.tsx` (lines 62-68)

- [ ] **Step 1: Write the wrapper**

```typescript
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadJSON(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(filename, blob);
}
```

- [ ] **Step 2: Refactor DangerZone.tsx**

Remove the inline DOM-manipulation block (lines 62-68) and replace with a call to `downloadJSON(filename, payload)`.

- [ ] **Step 3: Build and test**

Run: `npm --prefix frontend run build`
Expected: pass.

Trigger the backup download from the Danger Zone UI. Confirm a file downloads.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: wrap DOM-based file download in download module"
```

---

## Phase 12 — DataEntry Splitting (optional, large refactor)

### Task 12.1: Extract CSV upload preview, manual expense form, and income form

**Files:**
- Create: `frontend/src/components/data-entry/CSVUploadPreview.tsx`
- Create: `frontend/src/components/data-entry/ManualExpenseForm.tsx`
- Create: `frontend/src/components/data-entry/IncomeForm.tsx`
- Modify: `frontend/src/pages/DataEntry.tsx` (reduce from 959 to ~200 lines of orchestration)

Context: `DataEntry.tsx` has a `NOTE` comment (around line 34) acknowledging it's too large and deferring split. The audit confirms it's a top refactor target. This is optional — only proceed if the user approves after seeing the findings.

**GATE:** Before proceeding with Task 12, pause and review findings with user. This is the largest refactor in the plan; the user may want to cherry-pick which sub-components to extract. Do not auto-proceed from Phase 11 to Phase 12.

- [ ] **Step 1: Read DataEntry.tsx in full**

Read `frontend/src/pages/DataEntry.tsx` 1-300 and 300-600 and 600-959 in three reads.

- [ ] **Step 2: Identify the three natural seams**

The file has three major UI regions:
1. CSV upload + preview table (top section)
2. Manual expense entry form
3. Income entry + pay-stub form

Each has its own state, validation, and submit handler. Extract each into its own file, passing in shared state via props (transactions list for dedup, category list, onSave callback).

- [ ] **Step 3: Extract CSVUploadPreview.tsx**

Create the new file. Move everything specific to CSV handling (file input, parse result state, preview table, dedup flagging, bulk import button) into it. Export as default. Keep props minimal: `{ existingTransactions, categories, onImport }`.

- [ ] **Step 4: Extract ManualExpenseForm.tsx**

Same pattern.

- [ ] **Step 5: Extract IncomeForm.tsx**

Same pattern (includes PDF parsing flow).

- [ ] **Step 6: Refactor DataEntry.tsx to be thin orchestration**

It keeps: tab switching, the modal wrapper, and the success-flash state. Delegates form content to the three extracted components.

- [ ] **Step 7: Build and test thoroughly**

Run: `npm --prefix frontend run build`
Expected: pass.

Walk through EVERY flow: CSV upload (Chase + credit card formats), manual expense, income entry, pay-stub PDF upload. Regression test against a known dataset.

- [ ] **Step 8: Commit**

Because this is large, commit in stages:
```bash
git add frontend/src/components/data-entry/CSVUploadPreview.tsx
git add frontend/src/pages/DataEntry.tsx
git commit -m "refactor(data-entry): extract CSVUploadPreview component"

# repeat per extracted component
```

---

## Phase 13 — Mobile / React Native Readiness Report

### Task 13.1: Catalog RN-migration surface

**Files:**
- Create: `docs/mobile-readiness.md`

Context: the next agent will do the actual RN port. This document is their spec.

- [ ] **Step 1: Write the readiness report**

```markdown
# Lotus → React Native Migration Readiness

Document for the next agent. Generated 2026-04-23 after the code-review cleanup pass.

## What's Ready

- **Design tokens**: All colors, spacing, typography, and z-index are CSS variables (`frontend/src/index.css`). They can be mirrored in a `theme.ts` for RN.
- **Storage**: All localStorage/sessionStorage is behind `frontend/src/utils/storage.ts`. Swap the implementation to `@react-native-async-storage/async-storage` — callers don't change.
- **Dialogs**: All alert/confirm/prompt are behind `frontend/src/utils/dialog.ts`. Swap implementation to `Alert.alert` from `react-native`. Note: signatures are already `Promise<T>`.
- **File downloads**: DOM-manipulation is behind `frontend/src/utils/download.ts`. Swap to the RN `Share` API or `react-native-fs`.
- **Constants**: All timeouts, limits, and magic numbers are in `frontend/src/utils/constants.ts`.
- **Responsive CSS**: Mobile-first breakpoints (640, 1024). On RN, these become `useWindowDimensions()`-driven style picks.

## What Still Requires Hands-On Porting

### Third-party Libraries (each needs a direct swap)
| Current (web) | RN equivalent | Used in |
|---|---|---|
| `recharts` | `victory-native` or `react-native-svg-charts` | CategoryLineChart, ExpandedMonthView, NetBalanceView, MonthTotalsBar |
| `react-datepicker` | `@react-native-community/datetimepicker` | DateRangePicker |
| `qrcode.react` | `react-native-qrcode-svg` | Login (setup screen) |
| `pdfjs-dist` | Server-side parsing OR `react-native-pdf` | pdfParser utility |
| `@dnd-kit/core` et al | `react-native-draggable-flatlist` | Dashboard, Settings (dashboard reorder) |
| `react-router-dom` | `@react-navigation/native` | Whole router |

### DOM-Only Primitives
The whole JSX tree uses HTML elements (`<div>`, `<span>`, `<table>`, `<input>`, etc.). RN has `<View>`, `<Text>`, `<ScrollView>`, `<FlatList>`, `<TextInput>`, `<Pressable>`. This is a **line-by-line JSX rewrite** — there's no shortcut. Consider a codemod or deliberate per-component port.

### CSS
RN doesn't parse CSS files. Every style needs to become a JS object (StyleSheet.create) or a styled-components RN equivalent. The design tokens from `index.css` should be extracted into a `theme.ts` and consumed that way.

### Hash Routing (Login.tsx)
`window.location.hash` usage at Login.tsx:58, 66, 206. Replace with `react-navigation`'s imperative nav.

### Forms & Events
`<input onChange>` → `<TextInput onChangeText>` (and the value is the string, not the event).

## Offline Support (NOT YET IMPLEMENTED)

The code-review pass did NOT add offline support. Design notes for the next agent:

- **Cache layer**: wrap every `fetch` call in `frontend/src/api/client.ts` with a cache-first / network-fallback policy. Use IndexedDB on web and AsyncStorage on RN (with size caps).
- **Mutation queue**: writes go to a local queue first, then to network. Pending queue persists across app restarts. Serve optimistic UI reads from queue + cache.
- **Conflict resolution**: Phase 6 of the review added optimistic-concurrency versioning to data. Use that version field: on conflict, prompt user to retry or discard.
- **Service worker**: on web, consider a minimal SW for asset caching so the app shell loads offline.

## Breakage Watch List

When the RN port begins, specifically test:
1. Login + TOTP setup (QR code rendering)
2. CSV upload (file picker — RN uses `react-native-document-picker`)
3. Pay-stub PDF parsing (currently browser-side via pdfjs; may need to move to worker)
4. Dashboard card drag-reorder (DnD is very different on RN)
5. Date-range picker (datepicker lib swap)
6. Chart rendering (recharts swap is the biggest effort)
```

- [ ] **Step 2: Commit**

```bash
git add docs/mobile-readiness.md
git commit -m "docs: add React Native migration readiness report"
```

### Task 13.2: Finalize the findings report

- [ ] **Step 1: Sweep through `docs/code-review-findings-2026-04-23.md` and fill any remaining placeholders**

Every `(Populated in Phase X.)` marker should now be an actual list. If any aren't, go back and populate from git history.

- [ ] **Step 2: Add a final "Summary & Delta" section**

Append:

```markdown
## Summary & Delta

Starting LOC (Phase 0): <X>
Final LOC: <Y>
Delta: <Y-X> (<percent>%)

Security fixes applied: <count>
Race-conditions mitigated: <count>
Static inline styles extracted: <count>
localStorage call sites abstracted: <count>
```

- [ ] **Step 3: Commit**

```bash
git add docs/code-review-findings-2026-04-23.md
git commit -m "docs: finalize code review findings report"
```

---

## Final Verification

### Task F.1: End-to-end smoke test

- [ ] **Step 1: Full build**

Run: `npm --prefix frontend run build && (cd worker && npx tsc --noEmit)`
Expected: both exit 0.

- [ ] **Step 2: Dev worker + dev frontend**

Start both locally. Click through:
1. Login (existing credentials — verify backward compat on PBKDF2 format)
2. Dashboard (all four cards render, drag-reorder works)
3. Enter Data (CSV upload, manual entry, income)
4. Settings (categories, dashboard-card visibility)
5. Delete a transaction, confirm UI updates

Any regression → root-cause and fix before proceeding.

- [ ] **Step 3: Responsive check**

At 360px / 768px / 1280px viewports, every page should be usable. Screenshot each for the record.

- [ ] **Step 4: Count commits**

Run: `git log --oneline main..HEAD | wc -l`
Expected: a large number — this plan produces many small commits by design.

- [ ] **Step 5: Done**

Review `docs/code-review-findings-2026-04-23.md` one final time. Confirm it's complete and actionable for the next agent.

---

## Notes for the Executor

- **DO NOT skip verification steps.** Each task specifies a build-check; run it. A failing build caught one task later is much harder to untangle.
- **Prefer small commits.** Every `- [ ] Commit` step should produce its own commit, not a batched one. This plan produces ~60-80 commits.
- **If a task reveals an unexpected complication**, stop and surface it in a brief report to the user before forging ahead. Examples: an import turns out to be reflectively-used; a CSS rule breaks a non-obvious component; a KV migration needs a data-plane change.
- **Judgement calls** (hairline px vs token px; static vs dynamic inline style) should be documented in a one-line comment so the next reviewer can see the reasoning.
- **Gate Phase 12.** The DataEntry split is invasive. Only proceed after confirming with the user.
