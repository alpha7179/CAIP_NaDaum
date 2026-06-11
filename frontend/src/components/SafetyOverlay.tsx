// 고위험 감지 시 화면 표시 안전 개입 (외부 알림 없이 위기 상담 핫라인 노출)
import { EMERGENCY_CONTACTS } from '@nadaum/shared';
import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';


export function SafetyOverlay({
  onContinue,
  onEnd,
  stopped = false,
}: {
  onContinue: () => void;
  onEnd?: () => void;
  stopped?: boolean;
}) {
  const [offset, setOffset] = useState({ left: 0, bottom: 0 });
  useLayoutEffect(() => {
    const compute = () => {
      const sb = document.querySelector<HTMLElement>('.sidebar');
      const tb = document.querySelector<HTMLElement>('.tabbar');
      const left = sb && sb.offsetParent !== null ? sb.getBoundingClientRect().right : 0;
      const bottom = tb && tb.offsetParent !== null ? tb.getBoundingClientRect().height : 0;
      setOffset({ left, bottom });
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="위기 상담 안내"
      style={{
        position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)',
      }}
    >
      <div style={{
        position: 'absolute', top: 0, left: offset.left, right: 0, bottom: offset.bottom,
        display: 'grid', placeItems: 'center', padding: 20,
      }}>
      <div className="card fade" style={{ maxWidth: 420, width: '100%', padding: 28 }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: '#c80000', marginBottom: 10, textAlign: 'center' }}>
          {stopped ? '안전을 위해 대화를 잠시 멈췄어요' : '잠깐, 지금 많이 힘드신가요?'}
        </div>
        <div style={{ fontSize: 14.5, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 18, textAlign: 'center' }}>
          {stopped
            ? '지금은 전문 상담사의 도움이 꼭 필요해 보여요. 아래 번호로 연락하면 24시간 무료로 이야기를 나눌 수 있어요. 혼자가 아니에요.'
            : '혼자 견디지 않으셔도 괜찮아요. 아래 상담은 24시간 무료로 연결돼요. 지금 마음이 위급하다면 주저하지 말고 연락해 주세요.'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {EMERGENCY_CONTACTS.map((c) => (
            <a
              key={c.phone}
              href={`tel:${c.phone}`}
              className="card"
              style={{
                display: 'block', padding: '14px 16px', textDecoration: 'none',
                border: '1.5px solid var(--accent)', background: 'var(--accent-soft)',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 15.5, color: 'var(--text)' }}>
                {c.name} <span style={{ color: 'var(--accent)' }}>{c.phone}</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 4, lineHeight: 1.5 }}>
                {c.description}
              </div>
            </a>
          ))}
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.5, marginBottom: 16, textAlign: 'center' }}>
          「나, 다움」은 비의료 정서 기록 보조 도구로, 진단·처방·치료를 제공하지 않습니다.
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {!stopped && (
            <button className="btn btn-ghost btn-pill" style={{ flex: 1 }} onClick={onContinue}>
              계속 이야기하기
            </button>
          )}
          {onEnd && (
            <button className="btn btn-primary btn-pill" style={{ flex: 1 }} onClick={onEnd}>
              {stopped ? '대화 마치고 정리하기' : '대화 마치기'}
            </button>
          )}
        </div>
      </div>
      </div>
    </div>,
    document.body,
  );
}
