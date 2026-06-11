// 앱 공통 슬라이더 스위치 (on/off, size md/sm, role=switch)
export interface ToggleSwitchProps {
  readonly on: boolean;
  readonly onChange: () => void;
  readonly disabled?: boolean;
  readonly size?: 'md' | 'sm';
  readonly ariaLabel?: string;
  readonly className?: string;
}

export function ToggleSwitch({
  on,
  onChange,
  disabled = false,
  size = 'md',
  ariaLabel,
  className = '',
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onChange();
      }}
      className={
        `toggle-switch${on ? ' is-on' : ''}` +
        `${size === 'sm' ? ' toggle-switch--sm' : ''}` +
        `${className ? ' ' + className : ''}`
      }
    >
      <span className="toggle-switch-knob" aria-hidden />
    </button>
  );
}
