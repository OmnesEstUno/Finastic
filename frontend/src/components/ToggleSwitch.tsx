interface Props {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel?: string;
  disabled?: boolean;
}

// Small accessible on/off toggle. Renders as a <button role="switch">
// so assistive tech can announce state. Visual pill slides left→right.
export default function ToggleSwitch({ checked, onChange, ariaLabel, disabled }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`toggle-switch${checked ? ' toggle-switch--on' : ''}`}
    >
      <span className="toggle-switch__thumb" aria-hidden="true" />
    </button>
  );
}
