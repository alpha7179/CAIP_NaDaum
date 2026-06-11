// 일기 목록 / 상세 (백엔드 로드 + 샘플 폴백)
import type { DiaryEntry, EmotionScores } from '@nadaum/shared';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '../auth/AuthContext';
import { BackButton } from '../components/BackButton';
import { Dropdown } from '../components/Dropdown';
import { HighRiskShareWarningModal } from '../components/HighRiskShareWarningModal';
import { Icon } from '../components/Icon';
import { ShareDiaryModal } from '../components/ShareDiaryModal';
import { WaveOrb } from '../components/WaveOrb';

import { DiaryCardRow, deriveTitle, formatDiaryDate } from './HomePage';

type GoFn = (r: string, p?: string) => void;

const EMOTION_META: ReadonlyArray<readonly [keyof EmotionScores, string]> = [
  ['기쁨', '😊'],
  ['슬픔', '😢'],
  ['분노', '😠'],
  ['불안', '😰'],
  ['놀람', '😮'],
  ['혐오', '😣'],
  ['중립', '😐'],
];

function dominantEmotion(scores: EmotionScores): keyof EmotionScores {
  let best: keyof EmotionScores = '중립';
  let bestVal = -Infinity;
  for (const [key] of EMOTION_META) {
    const v = scores[key] ?? 0;
    if (v > bestVal) { bestVal = v; best = key; }
  }
  return best;
}

function isoMonthLabel(iso: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  return m ? `${m[1]}년 ${Number(m[2])}월` : '';
}

function monthRank(label: string): number {
  const m = /(\d{4})년\s*(\d{1,2})월/.exec(label);
  return m ? Number(m[1]) * 12 + Number(m[2]) : 0;
}

export function DiaryList({ go }: { go: GoFn }) {
  const { api } = useAuth();
  const [items, setItems] = useState<DiaryEntry[]>([]);
  const [filter, setFilter] = useState('전체');
  const [query, setQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('전체');

  useEffect(() => {
    let active = true;
    api.listDiaries(0)
      .then((res) => { if (active) setItems(res.items); })
      .catch(() => {});
    return () => { active = false; };
  }, [api]);

  const q = query.trim().toLowerCase();

  const presentEmotions = useMemo(() => {
    const set = new Set<keyof EmotionScores>();
    for (const d of items) set.add(dominantEmotion(d.emotionScores));
    return EMOTION_META.filter(([key]) => set.has(key));
  }, [items]);

  const monthOptions = useMemo(() => {
    const labels = items.map((d) => isoMonthLabel(d.sessionDate));
    const distinct = [...new Set(labels.filter((l) => l.length > 0))];
    distinct.sort((a, b) => monthRank(b) - monthRank(a));
    return ['전체', ...distinct];
  }, [items]);

  const itemsFiltered = items.filter((d) => {
    if (filter !== '전체' && dominantEmotion(d.emotionScores) !== filter) return false;
    if (dateFilter !== '전체' && isoMonthLabel(d.sessionDate) !== dateFilter) return false;
    if (q.length === 0) return true;
    const hay = `${deriveTitle(d.body)} ${d.body}`.toLowerCase();
    return hay.includes(q);
  });

  const monthLabel = dateFilter !== '전체'
    ? dateFilter
    : isoMonthLabel(items[0]?.sessionDate ?? '');

  return (
    <div className="page fade">
      <div className="page-back-row">
        <BackButton onClick={() => go('home')} />
      </div>
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div className="eyebrow">나의 기록</div>
          <h1 className="page-title" style={{ marginTop: 8 }}>일기</h1>
          <p className="page-sub">
            {items.length === 0
              ? '첫 대화를 시작하면 일기가 쌓여요.'
              : `지금까지 ${items.length}편의 하루가 쌓였어요.`}
          </p>
        </div>
        <button className="btn btn-primary btn-pill" onClick={() => go('chat')}>
          <Icon.plus /> 새 일기
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none', display: 'inline-flex' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/><path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </span>
          <input
            className="input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목·내용으로 검색"
            aria-label="일기 검색"
            style={{ paddingLeft: 46 }}
          />
        </div>
        {monthOptions.length > 1 && (
          <div className="diary-date-dd" style={{ width: 160, flexShrink: 0 }}>
            <Dropdown value={dateFilter} options={monthOptions} onChange={setDateFilter} />
          </div>
        )}
      </div>

      {presentEmotions.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          <button
            className={`chip${filter === '전체' ? ' chip-accent' : ''}`}
            onClick={() => setFilter('전체')}
            style={{ cursor: 'pointer' }}
          >
            전체
          </button>
          {presentEmotions.map(([key, emoji]) => (
            <button
              key={key}
              className={`chip${filter === key ? ' chip-accent' : ''}`}
              onClick={() => setFilter(key)}
              style={{ cursor: 'pointer' }}
            >
              <span style={{ fontSize: 15, marginRight: 4 }}>{emoji}</span>{key}
            </button>
          ))}
        </div>
      )}

      {monthLabel && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 18px' }}>
          <div style={{ height: 1, background: 'var(--border)', flex: 1 }} />
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-3)' }}>{monthLabel}</div>
          <div style={{ height: 1, background: 'var(--border)', flex: 1 }} />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '60px 0' }}>아직 일기가 없어요.</div>
        ) : itemsFiltered.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '60px 0' }}>
            {q.length > 0 || filter !== '전체' ? '조건에 맞는 일기가 없어요.' : '아직 일기가 없어요.'}
          </div>
        ) : (
          itemsFiltered.map((d) => <DiaryCardRow key={d.diaryId} d={d} go={go} />)
        )}
      </div>
    </div>
  );
}

export function DiaryDetail({ go, back, id }: { go: GoFn; back: () => void; id: string | null }) {
  const { api } = useAuth();
  const [entry, setEntry] = useState<DiaryEntry | undefined>();
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTab, setShareTab] = useState<'md' | 'image' | 'notion'>('md');
  const [shareBlockedOpen, setShareBlockedOpen] = useState(false);

  function handleShareClick(initialTab: 'md' | 'image' | 'notion') {
    if (entry?.peakRiskLevel === '고위험') {
      setShareBlockedOpen(true);
      return;
    }
    setShareTab(initialTab);
    setShareOpen(true);
  }

  useEffect(() => {
    if (!id) { setNotFound(true); return; }
    api.getDiary(id)
      .then(setEntry)
      .catch(() => setNotFound(true));
  }, [api, id]);

  function startEdit() {
    if (!entry) return;
    setDraft(entry.body);
    setEditing(true);
  }
  async function saveEdit() {
    if (!entry || draft.trim().length === 0) return;
    setBusy(true);
    try {
      const updated = await api.updateDiary(entry.diaryId, draft.trim());
      setEntry(updated);
      setEditing(false);
    } catch { } finally { setBusy(false); }
  }
  async function doDelete() {
    if (!entry) return;
    setBusy(true);
    try {
      await api.deleteDiary(entry.diaryId);
      go('diary');
    } catch { setBusy(false); }
  }

  if (entry) {
    return (
      <div className="app-scroll" style={{ position: 'relative' }}>
        <div className="atmos" />
        <div className="detail fade" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <BackButton onClick={back} label="일기로" />
            {!editing && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={startEdit}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 36, padding: '0 14px', borderRadius: 100, background: 'var(--surface-3)', color: 'var(--text-2)', fontSize: 13.5, fontWeight: 600, border: 'none', cursor: 'pointer' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  수정
                </button>
                <button
                  onClick={() => setConfirmDel(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 36, padding: '0 14px', borderRadius: 100, background: '#fff0f0', color: '#e03535', fontSize: 13.5, fontWeight: 600, border: 'none', cursor: 'pointer' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  삭제
                </button>
              </div>
            )}
          </div>

          <div className="detail-hero">
            <div className="detail-mood">📓</div>
            <div className="chip chip-accent">대화로 쓴 일기</div>
            <h1>{entry.title || deriveTitle(entry.body)}</h1>
            <div className="detail-meta">{formatDiaryDate(entry.sessionDate)} · 대화로 쓴 일기</div>
          </div>

          {editing ? (
            <>
              <textarea
                className="input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                style={{ width: '100%', minHeight: 280, height: 'auto', padding: 18, lineHeight: 1.8, fontSize: 16, resize: 'vertical' }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="btn btn-ghost btn-pill" onClick={() => setEditing(false)} disabled={busy}>취소</button>
                <button className="btn btn-primary btn-pill" onClick={saveEdit} disabled={busy || draft.trim().length === 0}>
                  {busy ? '저장 중…' : '저장'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="prose">
                {entry.body.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
              </div>
              <div className="detail-divider" />
              <div className="card" style={{ padding: 22, display: 'flex', gap: 14, alignItems: 'center', background: 'var(--surface-2)' }}>
                <div style={{ width: 44, height: 44, flexShrink: 0 }}><WaveOrb size={44} /></div>
                <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.55 }}>
                  이 일기는 <b style={{ color: 'var(--text)' }}>{formatDiaryDate(entry.sessionDate)}</b>의 대화를 바탕으로 나다움이 정리했어요.
                </div>
              </div>
              {(entry.tags ?? []).length > 0 && (
                <div className="tag-row" style={{ marginTop: 20, justifyContent: 'center' }}>
                  {(entry.tags ?? []).map((t) => <span className="tag" key={t}>#{t}</span>)}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 30 }}>
                <button className="btn btn-ghost btn-pill" onClick={() => handleShareClick('md')}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="2"/><circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="2"/><circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="2"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  공유
                </button>
                <button className="btn btn-primary btn-pill" onClick={() => go('diary')}>다른 일기 보기</button>
              </div>
            </>
          )}
        </div>

        {shareOpen && <ShareDiaryModal entry={entry} initialTab={shareTab} onClose={() => setShareOpen(false)} />}

        {shareBlockedOpen && <HighRiskShareWarningModal onClose={() => setShareBlockedOpen(false)} />}

        {confirmDel && (
          <div
            onClick={() => !busy && setConfirmDel(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.35)', display: 'grid', placeItems: 'center', padding: 20 }}
          >
            <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 360, width: '100%', padding: 28, textAlign: 'center' }}>
              <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 10 }}>일기를 삭제할까요?</div>
              <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 22 }}>
                삭제한 일기는 되돌릴 수 없어요.
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-ghost" onClick={() => setConfirmDel(false)} disabled={busy} style={{ flex: 1 }}>취소</button>
                <button className="btn" onClick={doDelete} disabled={busy} style={{ flex: 1, background: '#e03535', color: '#fff' }}>
                  {busy ? '삭제 중…' : '삭제'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app-scroll" style={{ position: 'relative' }}>
      <div className="detail fade" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: 28 }}>
          <BackButton onClick={back} label="일기로" />
        </div>
        <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '80px 0' }}>
          {notFound ? '일기를 찾을 수 없어요.' : '불러오는 중…'}
        </div>
      </div>
    </div>
  );
}
