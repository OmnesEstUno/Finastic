// frontend/src/components/CheckmarkToggle.tsx
interface Props {
  label: string;
  color?: string;           // chip color theme
  active: boolean;          // true = checkmark visible, false = hidden
  onToggle: () => void;
  onHover?: () => void;     // optional hover handler (for line highlighting)
  onLeave?: () => void;
  size?: 'sm' | 'md';
}

export default function CheckmarkToggle({ label, color, active, onToggle, onHover, onLeave, size = 'md' }: Props) {
  const themeColor = color ?? 'var(--accent)';
  const dim = size === 'sm' ? 18 : 24; // circle diameter
  const padding = size === 'sm' ? '4px 10px 4px 6px' : '6px 14px 6px 8px';
  return (
    <button
      onClick={onToggle}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding, borderRadius: 999,
        border: `1px solid ${active ? themeColor + '60' : 'var(--border)'}`,
        background: active ? themeColor + '18' : 'transparent',
        color: active ? themeColor : 'var(--text-muted)',
        cursor: 'pointer', fontSize: size === 'sm' ? '0.75rem' : '0.8125rem', fontWeight: 500,
        minHeight: 40,            /* mobile-friendly hit target */
        transition: 'all 0.15s',
      }}
      className="checkmark-toggle"
    >
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: dim, height: dim, borderRadius: '50%',
        background: active ? themeColor : 'transparent',
        border: `1.5px solid ${active ? themeColor : 'var(--border)'}`,
        color: 'var(--bg-base)',  /* checkmark renders on theme color */
        transition: 'all 0.15s',
      }}>
        {active && (
          <svg width={dim * 0.55} height={dim * 0.55} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      {label}
    </button>
  );
}
