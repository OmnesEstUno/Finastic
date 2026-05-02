# Accessibility Settings — Design

**Date:** 2026-05-01
**Status:** Approved (pending implementation plan)
**Scope:** This spec only. A separate follow-up spec covers the screen-reader audit and fix list.

---

## Goals

Add a single **Accessibility** card to the Settings page that gives users control over:

1. **Color palette** — four options: Dark (current default), Light, High-Visibility Dark, High-Visibility Light.
2. **Color-blind friendly chart colors** — toggle (lives visually inside the palette section).
3. **Handedness** — Right-handed (default) or Left-handed FAB stack position.
4. **Reduce motion** — Auto / Reduce / Allow.
5. **UI text scale** — Small / Medium / Large.

Out of scope: screen-reader audit (separate spec), per-account sync (chosen against in favor of localStorage).

---

## Storage

Single localStorage key, `lotus.accessibility.v1`. The `v1` suffix lets us migrate the shape later without blowing up existing prefs.

```ts
type AccessibilitySettings = {
  palette: 'dark' | 'light' | 'hi-vis-dark' | 'hi-vis-light';
  handedness: 'right' | 'left';
  reduceMotion: 'auto' | 'on' | 'off';
  textScale: 'sm' | 'md' | 'lg';
  colorBlindCharts: boolean;
};
```

**Defaults** (applied when key is absent or a field is undefined):
- `palette`: derived from `prefers-color-scheme` (light → `'light'`; otherwise `'dark'`).
- `handedness`: `'right'`.
- `reduceMotion`: `'auto'`.
- `textScale`: `'md'`.
- `colorBlindCharts`: `false`.

Per-device, no API roundtrip, no FOUC.

---

## Architecture (Approach C — hybrid)

Three pieces:

### 1. Pre-React inline script in `frontend/index.html`

Runs before the React bundle. Reads localStorage, falls back to system prefs, and sets data attributes on `<html>` *before* the first paint:

```html
<script>
  (function () {
    try {
      var s = JSON.parse(localStorage.getItem('lotus.accessibility.v1') || '{}');
      var prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
      var palette = s.palette || (prefersLight ? 'light' : 'dark');
      var rm = s.reduceMotion || 'auto';
      var reduce = rm === 'on' || (rm === 'auto' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      var html = document.documentElement;
      html.dataset.palette = palette;
      html.dataset.handedness = s.handedness || 'right';
      html.dataset.textScale = s.textScale || 'md';
      if (reduce) html.dataset.reduceMotion = 'on';
    } catch (e) { /* defaults via CSS */ }
  })();
</script>
```

### 2. `useAccessibilitySettings()` hook

Lives in `frontend/src/hooks/useAccessibilitySettings.ts`. Pattern mirrors `useDashboardLayout` but localStorage-backed via `utils/storage.ts`. Reads on mount, persists on change, mirrors settings to `<html>` data attributes (so the inline script's attributes stay in sync after user changes a setting).

Exposes: `{ settings, setPalette, setHandedness, setReduceMotion, setTextScale, setColorBlindCharts }`.

### 3. Chart color palette swap

`frontend/src/utils/categorization/colors.ts` gains a module-level palette flag. The hook updates the flag when `colorBlindCharts` toggles. `getCategoryColor()` reads the flag and returns a color from the appropriate palette. Charts re-render naturally because the toggle change triggers a re-render through the hook's consumers.

The color-blind palette uses the **Wong palette** (Nature Methods, 2011), designed for deuteranopia/protanopia/tritanopia:

| Index | Hex | Name |
|---|---|---|
| 0 | `#0072B2` | Blue |
| 1 | `#E69F00` | Orange |
| 2 | `#56B4E9` | Sky |
| 3 | `#009E73` | Green |
| 4 | `#F0E442` | Yellow |
| 5 | `#D55E00` | Vermillion |
| 6 | `#CC79A7` | Purple |
| 7 | `#000000` | Black/Gray |

Categories beyond 8 derive hues from the same set with brightness shifts.

**Note on the black/gray slot:** Wong's index 7 is `#000000`, which is invisible on hi-vis-dark backgrounds. Implementation should substitute a mid-gray (e.g., `#888888`) when the active palette is dark, OR use index 7 last and only when the chart needs that many slots.

---

## UI

### Card placement

A new `<AccessibilityCard />` component in `frontend/src/components/`, rendered in `Settings.tsx` between **Workspaces** and **Dashboard Card Visibility**. Same `<div className="card">` shell, same `<div className="card-header"><h2>Accessibility</h2></div>` pattern as every other settings card.

### Card layout

```
┌─────────────────────────────────────────────┐
│ Accessibility                                │
├─────────────────────────────────────────────┤
│ Color palette                                │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌─────────┐       │
│ │ Dark │ │Light │ │Hi-Vis│ │ Hi-Vis  │       │
│ │  ●   │ │      │ │ Dark │ │  Light  │       │
│ └──────┘ └──────┘ └──────┘ └─────────┘       │
│ ☐ Use color-blind friendly chart colors      │
│                                               │
│ ─────────────                                │
│ Layout                                        │
│ ◉ Right-handed   ○ Left-handed                │
│                                               │
│ ─────────────                                │
│ Motion                                        │
│ ◉ Auto (follow system)                        │
│ ○ Reduce  ○ Allow                             │
│                                               │
│ ─────────────                                │
│ Text size                                     │
│ ○ Small  ◉ Medium  ○ Large                    │
└─────────────────────────────────────────────┘
```

### Controls

- **Palette picker:** four button-cards in a row (wraps to 2×2 on narrow viewports). Each card shows a small swatch preview (4 colored squares: bg-base, bg-card, accent, text-primary). Selected card gets accent border + check icon. Clickable area: full card.
- **Color-blind charts:** native `<input type="checkbox">` styled with the existing toggle pattern, sits inside the palette section visually. Independent of palette choice.
- **Handedness:** segmented radio group (`Right-handed` / `Left-handed`), real `<input type="radio">` for SR support.
- **Motion:** three-way radio (`Auto` / `Reduce` / `Allow`).
- **Text size:** three-way radio (`Small` / `Medium` / `Large`).

Each subsection has an `<h3>` header so screen-reader users can jump between them. No save button — changes apply instantly.

---

## CSS architecture

### Palette tokens

The existing `:root` block in `frontend/src/index.css` keeps the dark-mode tokens as the default. Three new attribute-scoped blocks override the relevant tokens:

```css
[data-palette="light"] {
  --bg-base: #faf9ff;
  --bg-surface: #f3f1fb;
  --bg-card: #ffffff;
  --bg-elevated: #ede9fe;
  --border: #ddd6fe;
  --border-subtle: #ede9fe;
  --accent: #6366f1;
  --accent-hover: #4f46e5;
  --accent-dim: rgba(99, 102, 241, 0.15);
  --text-primary: #1e1b4b;
  --text-secondary: #4338ca;
  --text-muted: #6366f1;
  --success: #16a34a;
  --success-bg: rgba(22, 163, 74, 0.1);
  --danger: #dc2626;
  --danger-bg: rgba(220, 38, 38, 0.1);
  --warning: #d97706;
  --warning-bg: rgba(217, 119, 6, 0.1);
}

[data-palette="hi-vis-dark"] {
  --bg-base: #000000;
  --bg-surface: #000000;
  --bg-card: #000000;
  --bg-elevated: #1a1a1a;
  --border: #ffffff;
  --border-subtle: #444444;
  --accent: #ffeb3b;
  --accent-hover: #ffc107;
  --accent-dim: rgba(255, 235, 59, 0.2);
  --text-primary: #ffffff;
  --text-secondary: #ffffff;
  --text-muted: #e0e0e0;
  --success: #00e676;
  --success-bg: rgba(0, 230, 118, 0.15);
  --danger: #ff8080;
  --danger-bg: rgba(255, 128, 128, 0.15);
  --warning: #ffd740;
  --warning-bg: rgba(255, 215, 64, 0.15);
}

[data-palette="hi-vis-light"] {
  --bg-base: #ffffff;
  --bg-surface: #ffffff;
  --bg-card: #ffffff;
  --bg-elevated: #f5f5f5;
  --border: #000000;
  --border-subtle: #999999;
  --accent: #4527a0;
  --accent-hover: #311b92;
  --accent-dim: rgba(69, 39, 160, 0.15);
  --text-primary: #000000;
  --text-secondary: #000000;
  --text-muted: #1a1a1a;
  --success: #1b5e20;
  --success-bg: rgba(27, 94, 32, 0.1);
  --danger: #b71c1c;
  --danger-bg: rgba(183, 28, 28, 0.1);
  --warning: #6e4500;
  --warning-bg: rgba(110, 69, 0, 0.1);
}
```

The whole app picks these up automatically since everything already consumes `var(--bg-*)` / `var(--accent)` / `var(--text-*)`.

### Reduce motion

```css
[data-reduce-motion="on"] *,
[data-reduce-motion="on"] *::before,
[data-reduce-motion="on"] *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
  scroll-behavior: auto !important;
}
```

### Text scale

```css
:root[data-text-scale="sm"] { font-size: 14px; }
:root[data-text-scale="md"] { font-size: 16px; }  /* default */
:root[data-text-scale="lg"] { font-size: 18px; }
```

The whole app scales because all sizing tokens are `rem`-based.

### Handedness

Both FABs move into a single `position: fixed` container, stacked vertically. The container's `right` / `left` flips based on `[data-handedness]`:

```css
.fab-stack {
  position: fixed;
  bottom: 24px;
  display: flex;
  flex-direction: column-reverse; /* enter-data on bottom, workspaces above */
  gap: 12px;
  z-index: var(--z-sticky);
}
[data-handedness="right"] .fab-stack { right: 24px; }
[data-handedness="left"]  .fab-stack { left: 24px; }

@media (max-width: 639px) {
  .fab-stack { bottom: 16px; }
  [data-handedness="right"] .fab-stack { right: 16px; }
  [data-handedness="left"]  .fab-stack { left: 16px; }
}
```

The workspace popover (`workspace-picker-list`) anchors to the same side as the FAB:

```css
[data-handedness="left"]  .workspace-picker-list { align-items: flex-start; }
[data-handedness="right"] .workspace-picker-list { align-items: flex-end; }
```

---

## File touch list

**New files:**
- `frontend/src/hooks/useAccessibilitySettings.ts`
- `frontend/src/components/AccessibilityCard.tsx`

**Modified:**
- `frontend/index.html` — pre-React inline script
- `frontend/src/index.css` — three new `[data-palette="..."]` blocks, reduce-motion rule, text-scale rules, handedness rules; removal of FAB-specific positioning that moves into `.fab-stack`
- `frontend/src/components/layout/Layout.tsx` — wrap both FABs in a single `.fab-stack` container
- `frontend/src/components/layout/WorkspacePickerFAB.tsx` — drop the outer positioning wrapper (positioning now handled by `.fab-stack` + handedness)
- `frontend/src/utils/categorization/colors.ts` — add palette flag, return Wong-palette colors when on
- `frontend/src/pages/Settings.tsx` — render `<AccessibilityCard />` between Workspaces and Dashboard Card Visibility

---

## Testing & verification

- **Build clean:** `cd frontend && npx tsc --noEmit && npm run build` after each commit.
- **Manual smoke matrix:** all 4 palettes × right/left handed × 3 text scales × motion auto/reduce/allow. Spot-check on dashboard, settings, data entry. 320px / 375px / desktop.
- **No-FOUC verification:** hard-refresh after changing palette to light/hi-vis. First paint must be the chosen palette, not dark.
- **WCAG audit:** verify high-vis palettes hit AAA (≥7:1 text, ≥4.5:1 UI components) using a contrast checker.
- **Color-blind charts:** flip the toggle on a workspace with several categories, verify chart colors come from the Wong palette.
- **Keyboard a11y:** tab through the Accessibility card; all controls reachable; selection state announced; ESC/Tab behavior reasonable.
- **System preference defaults:** wipe localStorage, set OS to light mode, reload — should land in Light palette. Same for `prefers-reduced-motion`.

---

## Decisions made during brainstorm

- **localStorage over per-account sync.** Avoids FOUC; allows different palettes on different devices.
- **Four discrete palettes, not two axes.** Simpler picker; clearer mental model.
- **No "verbose mode" screen-reader toggle.** Baseline accessibility is always on; verbose can come later if asked for.
- **Color-blind chart toggle visually inside the palette section** but logically independent — works with any palette.
- **Wong palette** for color-blind charts (well-established, used by Nature, free).
- **Screen-reader audit deferred** to a separate spec.
