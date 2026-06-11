// 고위험 일기 공유 차단 경고 모달 (위기 상담 핫라인 안내)
import { EMERGENCY_CONTACTS } from '@nadaum/shared';
import { createPortal } from 'react-dom';


interface Props {
  onClose: () => void;
}

export function HighRiskShareWarningModal({ onClose }: Props) {
  return createPortal(
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="공유할 수 없는 일기"
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.45)',
        display: 'grid', placeItems: 'center', padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{
          maxWidth: 420, width: '100%', padding: 28,
        }}
      >
        <div style={{ fontSize: 19, fontWeight: 800, color: '#c80000', marginBottom: 10, textAlign: 'center' }}>
          공유할 수 없는 일기
        </div>

        <p style={{ fontSize: 14.5, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 18, textAlign: 'center' }}>
          이 일기는 고위험 상황으로 분류된 대화에서 작성되었어요.
          마음의 안전을 위해 외부로 공유하지 않도록 도와드리고 있어요.
        </p>

        <div
          style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 14, padding: 14, marginBottom: 18,
            display: 'flex', flexDirection: 'column', gap: 10,
          }}
        >
          {EMERGENCY_CONTACTS.map((c) => (
            <a
              key={c.phone}
              href={`tel:${c.phone}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                textDecoration: 'none', color: 'var(--text)',
              }}
            >
              <span
                aria-hidden
                style={{
                  display: 'inline-grid', placeItems: 'center',
                  width: 36, height: 36, borderRadius: 10,
                  background: 'var(--accent-soft)', color: 'var(--accent)',
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>
                  {c.name} · {c.phone}
                </span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-3)', marginTop: 2 }}>
                  {c.description}
                </span>
              </span>
            </a>
          ))}
        </div>

        <button
          onClick={onClose}
          className="btn btn-primary"
          style={{ width: '100%', height: 46 }}
          autoFocus
        >
          확인
        </button>
      </div>
    </div>,
    document.body,
  );
}
