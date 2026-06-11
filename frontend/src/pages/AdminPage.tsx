// 관리자 사용자 관리 페이지
import type { DiaryEntry, EmotionScores } from '@nadaum/shared';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';

import type { UserSummary, AvailableModel } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Avatar } from '../components/Avatar';
import { BackButton } from '../components/BackButton';

function EmotionBadge({ scores }: { scores: EmotionScores }) {
  const top = (Object.entries(scores) as [string, number][])
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2);
  return (
    <span style={{ display: 'flex', gap: 4 }}>
      {top.map(([k, v]) => (
        <span key={k} style={{ fontSize: 11, fontWeight: 600, background: 'var(--surface-3)', borderRadius: 6, padding: '2px 7px', color: 'var(--text-2)' }}>
          {k} {v}
        </span>
      ))}
    </span>
  );
}

function DiaryViewer({ diary, onClose }: { diary: DiaryEntry; onClose: () => void }) {
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
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)',
    }}
    onClick={onClose}
    >
      <div style={{
        position: 'absolute', top: 0, left: offset.left, right: 0, bottom: offset.bottom,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
      <div
        style={{
          background: 'var(--surface)', borderRadius: 20, padding: 28, maxWidth: 560, width: '100%',
          maxHeight: '80vh', overflowY: 'auto', boxShadow: 'var(--shadow-elevated)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{diary.title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{new Date(diary.sessionDate).toLocaleString('ko-KR')}</div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--surface-2)', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>
        {diary.emotionScores && (
          <div style={{ marginBottom: 14 }}>
            <EmotionBadge scores={diary.emotionScores} />
          </div>
        )}
        <div style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
          {diary.body}
        </div>
      </div>
      </div>
    </div>,
    document.body,
  );
}

function providerColor(provider: string): string {
  if (provider === 'anthropic') return '#c47b2b';
  if (provider === 'google')    return '#1a73e8';
  if (provider === 'xai')       return '#111';
  return '#1faa6a';
}

function ModelPicker({ models, value, disabled, onChange }: {
  models: AvailableModel[];
  value: string | undefined;
  disabled: boolean;
  onChange: (modelId: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ left: number; width: number; top: number; maxHeight: number } | null>(null);
  const current = models.find((m) => m.id === value);
  const label = current?.label ?? '기본값';
  const dotColor = current ? providerColor(current.provider) : 'var(--text-3)';

  const place = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;
    const gap = 6;
    const width = Math.max(210, r.width);
    const left = Math.max(margin, Math.min(r.left, vw - width - margin));
    const top = r.bottom + gap;
    const maxHeight = Math.max(120, Math.min(280, vh - top - margin));
    setPos({ left, width, top, maxHeight });
  }, []);

  function toggle() {
    if (disabled) return;
    if (open) { setOpen(false); return; }
    place();
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  const item = (active: boolean, dot: string, text: string, onClick: () => void) => (
    <button
      key={text}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: 44,
        flexShrink: 0,
        padding: '0 14px', background: active ? 'var(--accent-soft)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text)', border: 'none', borderRadius: 12,
        fontSize: 15, fontWeight: active ? 700 : 400, cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />
        {text}
      </span>
      {active && (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
          <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  );

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        onClick={toggle}
        disabled={disabled}
        title={label}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, height: 32, padding: '0 12px', borderRadius: 10,
          background: 'var(--surface-3)', color: 'var(--text-2)', border: '1px solid var(--border)',
          cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 12.5, fontWeight: 600, opacity: disabled ? 0.6 : 1,
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
        {label}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 2 }}>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && pos && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
          <div className="model-pop" style={{
            position: 'fixed', top: pos.top, left: pos.left, background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: 16, padding: 6, boxShadow: '0 12px 40px rgba(0,0,0,0.16)',
            zIndex: 200, minWidth: pos.width, maxHeight: pos.maxHeight,
            display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            {item(value === undefined, 'var(--text-3)', '기본값 (서버 설정)', () => { onChange(undefined); setOpen(false); })}
            {models.map((m) => item(value === m.id, providerColor(m.provider), m.label, () => { onChange(m.id); setOpen(false); }))}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}

function UserRow({ user, myUserId, api, models, onDeleted, onModelChanged }: {
  user: UserSummary;
  myUserId: string | undefined;
  api: ReturnType<typeof useAuth>['api'];
  models: AvailableModel[];
  onDeleted: (userId: string) => void;
  onModelChanged: (userId: string, modelId: string | undefined) => void;
}) {
  const isMe = user.userId === myUserId;
  const [expanded, setExpanded] = useState(false);
  const [diaries, setDiaries] = useState<DiaryEntry[]>([]);
  const [diaryPage, setDiaryPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [diaryLoading, setDiaryLoading] = useState(false);
  const [diaryError, setDiaryError] = useState('');
  const [viewDiary, setViewDiary] = useState<DiaryEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [modelBusy, setModelBusy] = useState(false);

  async function handleModelChange(next: string | undefined) {
    setModelBusy(true);
    try {
      await api.setUserModel(user.userId, next ?? null);
      onModelChanged(user.userId, next);
    } catch (e) {
      alert(e instanceof Error ? e.message : '모델 지정 실패');
    } finally {
      setModelBusy(false);
    }
  }

  async function loadDiaries(page = 0) {
    setDiaryLoading(true);
    setDiaryError('');
    try {
      const res = await api.getAdminUserDiaries(user.userId, page);
      setDiaries(res.items);
      setHasNext(res.hasNext);
      setDiaryPage(page);
    } catch (e) {
      setDiaryError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setDiaryLoading(false);
    }
  }

  function handleExpand() {
    if (!expanded && diaries.length === 0) {
      void loadDiaries(0);
    }
    setExpanded((v) => !v);
  }

  async function handleDelete() {
    if (!confirm(`정말 "${user.email}" 계정을 삭제할까요? 모든 데이터가 영구 삭제됩니다.`)) return;
    setBusy(true);
    try {
      await api.deleteAdminUser(user.userId);
      onDeleted(user.userId);
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제 실패');
      setBusy(false);
    }
  }

  async function handleToggleAdmin() {
    setBusy(true);
    try {
      await api.setAdminUser(user.userId, !user.isAdmin);
      alert(`${user.isAdmin ? '관리자 해제' : '관리자 지정'} 완료. 목록을 새로고침해주세요.`);
    } catch (e) {
      alert(e instanceof Error ? e.message : '수정 실패');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {viewDiary && <DiaryViewer diary={viewDiary} onClose={() => setViewDiary(null)} />}
      <div style={{
        borderRadius: 14,
        background: isMe ? 'var(--accent-soft)' : 'var(--surface-2)',
        border: `1.5px solid ${isMe ? 'var(--accent)' : 'var(--border)'}`,
        overflow: 'hidden',
        marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', gap: 12 }}>
          <Avatar name={user.name} email={user.email} photo={user.photoUrl} size={36} />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                {user.name && user.name.length > 0 ? user.name : user.email}
              </span>
              {isMe && <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-soft)', borderRadius: 5, padding: '1px 6px' }}>나</span>}
              {user.isAdmin && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#e89320', background: 'rgba(232,147,32,0.12)', borderRadius: 5, padding: '1px 6px' }}>관리자</span>}
            </div>
            {user.name && user.name.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>
                {user.email}
              </div>
            )}
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2, fontFamily: 'monospace' }}>
              {user.userId}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
              가입: {new Date(user.createdAt).toLocaleDateString('ko-KR')}
            </div>
            {models.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <span style={{ fontSize: 11.5, color: 'var(--text-3)', flexShrink: 0 }}>사용 모델</span>
                <ModelPicker
                  models={models}
                  value={user.assignedModel}
                  disabled={modelBusy}
                  onChange={(id) => void handleModelChange(id)}
                />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              onClick={handleExpand}
              style={{
                height: 32, padding: '0 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                background: expanded ? 'var(--accent-soft)' : 'var(--surface-3)',
                color: expanded ? 'var(--accent)' : 'var(--text-2)',
                border: `1px solid ${expanded ? 'var(--accent)' : 'var(--border)'}`,
                cursor: 'pointer',
              }}
            >
              {expanded ? '접기' : '일기 보기'}
            </button>
            {!isMe && (
              <>
                <button
                  onClick={handleToggleAdmin}
                  disabled={busy}
                  style={{
                    height: 32, padding: '0 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                    background: user.isAdmin ? 'rgba(232,147,32,0.1)' : 'var(--surface-3)',
                    color: user.isAdmin ? '#e89320' : 'var(--text-2)',
                    border: `1px solid ${user.isAdmin ? 'rgba(232,147,32,0.25)' : 'var(--border)'}`,
                    cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
                  }}
                >
                  {user.isAdmin ? '관리자 해제' : '관리자 지정'}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={busy}
                  style={{
                    height: 32, padding: '0 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                    background: 'rgba(224,64,64,0.08)', color: '#e04040',
                    border: '1px solid rgba(224,64,64,0.2)',
                    cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
                  }}
                >
                  탈퇴
                </button>
              </>
            )}
          </div>
        </div>

        {expanded && (
          <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px' }}>
            {diaryLoading && (
              <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 13.5, padding: '8px 0' }}>불러오는 중…</div>
            )}
            {diaryError && (
              <div style={{ color: '#e04040', fontSize: 13, marginBottom: 8 }}>{diaryError}</div>
            )}
            {!diaryLoading && diaries.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 13.5, padding: '8px 0' }}>
                작성된 일기·상담 기록이 없습니다.
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {diaries.map((d) => (
                <button
                  key={d.diaryId}
                  onClick={() => setViewDiary(d)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%', textAlign: 'left',
                    padding: '10px 14px', borderRadius: 10,
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>
                      {new Date(d.sessionDate).toLocaleDateString('ko-KR')}
                    </div>
                    {d.emotionScores && <EmotionBadge scores={d.emotionScores} />}
                  </div>
                  <span style={{ fontSize: 11.5, color: 'var(--accent)', fontWeight: 600, flexShrink: 0, paddingTop: 2 }}>보기 →</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 10 }}>
              {diaryPage > 0 && (
                <button
                  onClick={() => loadDiaries(diaryPage - 1)}
                  style={{ height: 32, padding: '0 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, background: 'var(--surface-3)', color: 'var(--text-2)', border: '1px solid var(--border)', cursor: 'pointer' }}
                >
                  ← 이전
                </button>
              )}
              {hasNext && (
                <button
                  onClick={() => loadDiaries(diaryPage + 1)}
                  style={{ height: 32, padding: '0 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, background: 'var(--surface-3)', color: 'var(--text-2)', border: '1px solid var(--border)', cursor: 'pointer' }}
                >
                  다음 →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export function AdminPage() {
  const navigate = useNavigate();
  const { api, userId: myUserId } = useAuth();

  const [users, setUsers] = useState<UserSummary[]>([]);
  const [models, setModels] = useState<AvailableModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await api.getAdminUsers();
      setUsers(res.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    api.getModels().then((res) => setModels(res.models)).catch(() => {});
  }, []);

  return (
    <div className="page fade">
      <div className="page-back-row">
        <BackButton onClick={() => navigate('/home')} />
      </div>
      <div className="page-head">
        <div className="eyebrow">관리자</div>
        <h1 className="page-title" style={{ marginTop: 8 }}>사용자 관리</h1>
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
            전체 사용자 <span style={{ color: 'var(--accent)', fontWeight: 800 }}>{users.length}</span>명
          </span>
          <button
            className="btn btn-primary"
            onClick={load}
            disabled={loading}
            style={{ height: 36, padding: '0 16px', fontSize: 13.5 }}
          >
            {loading ? '로딩 중…' : '새로고침'}
          </button>
        </div>

        {error && (
          <div style={{ color: '#e04040', fontSize: 13.5, marginBottom: 12 }}>{error}</div>
        )}

        {!loading && users.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 14, padding: '20px 0' }}>
            사용자가 없습니다.
          </div>
        )}

        <div>
          {users.map((user) => (
            <UserRow
              key={user.userId}
              user={user}
              myUserId={myUserId}
              api={api}
              models={models}
              onDeleted={(id) => setUsers((u) => u.filter((x) => x.userId !== id))}
              onModelChanged={(id, modelId) =>
                setUsers((u) => u.map((x) => {
                  if (x.userId !== id) return x;
                  const next = { ...x };
                  if (modelId !== undefined) next.assignedModel = modelId;
                  else delete next.assignedModel;
                  return next;
                }))
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
