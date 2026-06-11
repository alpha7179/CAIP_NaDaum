// 토스 스타일 커스텀 셀렉트 (펼침 목록 둥근 모서리·그림자)
import { useEffect, useRef, useState } from 'react';

export interface DropdownProps {
  readonly value: string;
  readonly options: string[];
  readonly label?: string;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly onChange: (value: string) => void;
}

export function Dropdown({ value, options, label, placeholder = '선택해 주세요', disabled = false, onChange }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const floated = open || value !== '';

  return (
    <div className="dd" ref={ref} style={{ opacity: disabled ? 0.5 : 1 }}>
      <button
        type="button"
        className={`dd-trigger${open ? ' open' : ''}${label ? ' has-label' : ''}`}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        {label !== undefined ? (
          <span className="dd-field">
            <span className={`dd-label${floated ? ' floated' : ''}`}>{label}</span>
            {value !== '' && <span className="dd-value">{value}</span>}
          </span>
        ) : (
          <span className={value ? 'dd-value' : 'dd-placeholder'}>{value || placeholder}</span>
        )}
        <svg className={`dd-chevron${open ? ' up' : ''}`} width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M6 9l6 6 6-6" stroke="#8b95a1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="dd-menu">
          {options.map((opt) => (
            <button
              type="button"
              key={opt}
              className={`dd-option${opt === value ? ' selected' : ''}`}
              onClick={() => { onChange(opt); setOpen(false); }}
            >
              {opt}
              {opt === value && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
