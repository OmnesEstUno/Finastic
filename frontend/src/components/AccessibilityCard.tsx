import {
  useAccessibilitySettings,
  type Palette,
  type Handedness,
  type ReduceMotion,
  type TextScale,
} from '../hooks/useAccessibilitySettings';
import CollapsibleCard from './CollapsibleCard';

interface PaletteOption {
  value: Palette;
  label: string;
  swatch: { bg: string; card: string; accent: string; text: string; badgeFg: string };
}

// Hex values mirror the CSS custom properties in index.css.
// Keep in sync if palette tokens change.
const PALETTES: PaletteOption[] = [
  {
    value: 'dark',
    label: 'Dark',
    swatch: { bg: '#09090b', card: '#27272a', accent: '#818cf8', text: '#fafafa', badgeFg: '#0f0f1a' },
  },
  {
    value: 'light',
    label: 'Light',
    swatch: { bg: '#faf9ff', card: '#ffffff', accent: '#4f46e5', text: '#1e1b4b', badgeFg: '#ffffff' },
  },
  {
    value: 'hi-vis-dark',
    label: 'Hi-Vis Dark',
    swatch: { bg: '#000000', card: '#1a1a1a', accent: '#ffeb3b', text: '#ffffff', badgeFg: '#0f0f1a' },
  },
  {
    value: 'hi-vis-light',
    label: 'Hi-Vis Light',
    swatch: { bg: '#ffffff', card: '#f5f5f5', accent: '#4527a0', text: '#000000', badgeFg: '#ffffff' },
  },
];

export default function AccessibilityCard() {
  const {
    settings,
    setPalette,
    setHandedness,
    setReduceMotion,
    setTextScale,
    setColorBlindCharts,
  } = useAccessibilitySettings();

  return (
    <CollapsibleCard title="Accessibility">
      {/* ─── Color palette ─────────────────────────────────────── */}
      <div className="a11y-section">
        <h3 className="a11y-section-title">Color palette</h3>
        <div className="palette-swatch-grid">
          {PALETTES.map((p) => (
            <button
              key={p.value}
              type="button"
              className="palette-swatch"
              aria-pressed={settings.palette === p.value}
              aria-label={`${p.label} palette`}
              onClick={() => setPalette(p.value)}
            >
              <div
                className="palette-swatch-preview"
                aria-hidden="true"
                style={{
                  background: `linear-gradient(135deg, ${p.swatch.bg} 0% 50%, ${p.swatch.card} 50% 100%)`,
                  position: 'relative',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: p.swatch.text,
                    fontWeight: 700,
                  }}
                >
                  <span style={{ background: p.swatch.accent, padding: '0 8px', borderRadius: 3, color: p.swatch.badgeFg }}>
                    Aa
                  </span>
                </span>
              </div>
              <span className="palette-swatch-name">{p.label}</span>
              {settings.palette === p.value && (
                <span aria-hidden="true" className="palette-swatch-check">✓</span>
              )}
            </button>
          ))}
        </div>
        <label className="a11y-radio-label">
          <input
            type="checkbox"
            checked={settings.colorBlindCharts}
            onChange={(e) => setColorBlindCharts(e.target.checked)}
          />
          Use color-blind friendly chart colors
        </label>
      </div>

      {/* ─── Layout (handedness) ──────────────────────────────── */}
      <div className="a11y-section">
        <h3 className="a11y-section-title">Layout</h3>
        <div className="a11y-radio-group" role="radiogroup" aria-label="Handedness">
          {(['right', 'left'] as Handedness[]).map((value) => (
            <label key={value} className="a11y-radio-label">
              <input
                type="radio"
                name="handedness"
                value={value}
                checked={settings.handedness === value}
                onChange={() => setHandedness(value)}
              />
              {value === 'right' ? 'Right-handed' : 'Left-handed'}
            </label>
          ))}
        </div>
      </div>

      {/* ─── Motion ───────────────────────────────────────────── */}
      <div className="a11y-section">
        <h3 className="a11y-section-title">Motion</h3>
        <div className="a11y-radio-group" role="radiogroup" aria-label="Motion">
          {(
            [
              { value: 'auto', label: 'Auto (follow system)' },
              { value: 'on', label: 'Reduce' },
              { value: 'off', label: 'Allow' },
            ] as { value: ReduceMotion; label: string }[]
          ).map((opt) => (
            <label key={opt.value} className="a11y-radio-label">
              <input
                type="radio"
                name="reduceMotion"
                value={opt.value}
                checked={settings.reduceMotion === opt.value}
                onChange={() => setReduceMotion(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* ─── Text size ─────────────────────────────────────────── */}
      <div className="a11y-section">
        <h3 className="a11y-section-title">Text size</h3>
        <div className="a11y-radio-group" role="radiogroup" aria-label="Text size">
          {(
            [
              { value: 'sm', label: 'Small' },
              { value: 'md', label: 'Medium' },
              { value: 'lg', label: 'Large' },
            ] as { value: TextScale; label: string }[]
          ).map((opt) => (
            <label key={opt.value} className="a11y-radio-label">
              <input
                type="radio"
                name="textScale"
                value={opt.value}
                checked={settings.textScale === opt.value}
                onChange={() => setTextScale(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>
    </CollapsibleCard>
  );
}
