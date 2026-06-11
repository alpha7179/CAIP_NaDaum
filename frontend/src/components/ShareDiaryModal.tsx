// 일기 공유 모달 (마크다운 / 이미지 / 노션)
import type { DiaryEntry } from '@nadaum/shared';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';

import type { NotionStatus } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import {
  buildDiaryMarkdown,
  countDiaryLines,
  diaryFileBase,
  renderDiaryImage,
  saveBlob,
  SUMMARY_DEFAULT_LINES,
  SUMMARY_MIN_LINES,
} from '../utils/diaryShare';
import { renderMarkdown } from '../utils/markdown';

type Tab = 'md' | 'image' | 'notion';

export function ShareDiaryModal({
  entry,
  onClose,
  initialTab = 'md',
}: {
  entry: DiaryEntry;
  onClose: () => void;
  initialTab?: Tab;
}) {
  const { api } = useAuth();
  const [tab, setTab] = useState<Tab>(initialTab);

  const [scopeMode, setScopeMode] = useState<'full' | 'summary'>('full');
  const [summaryLines, setSummaryLines] = useState<number>(SUMMARY_DEFAULT_LINES);
  const maxLines = useMemo(() => countDiaryLines(entry.body), [entry.body]);
  useEffect(() => {
    setSummaryLines((n) => Math.min(n, maxLines));
  }, [maxLines]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryErr, setSummaryErr] = useState<string | null>(null);
  const scopedEntry = useMemo(() => {
    if (tab !== 'notion' && scopeMode === 'summary' && aiSummary !== null) {
      return { ...entry, body: aiSummary };
    }
    return entry;
  }, [entry, tab, scopeMode, aiSummary]);

  function selectFull() {
    setScopeMode('full');
    setAiSummary(null);
    setSummaryErr(null);
  }
  function selectSummary() {
    setScopeMode('summary');
  }
  function changeSummaryLines(n: number) {
    setSummaryLines(Math.min(n, maxLines));
    setAiSummary(null);
    setSummaryErr(null);
  }
  async function runAiSummary() {
    if (summaryLoading) return;
    if (aiSummary !== null) {
      setAiSummary(null);
      setSummaryErr(null);
      return;
    }
    setSummaryLoading(true);
    setSummaryErr(null);
    try {
      const { summary } = await api.summarizeDiary(entry.diaryId, summaryLines);
      setAiSummary(summary.trim().length > 0 ? summary : entry.body);
    } catch {
      setSummaryErr('요약을 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSummaryLoading(false);
    }
  }

  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgBlob, setImgBlob] = useState<Blob | null>(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [imgErr, setImgErr] = useState<string | null>(null);

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

  const [notionStatus, setNotionStatus] = useState<NotionStatus | null>(null);
  const [notionLoading, setNotionLoading] = useState(false);
  const [notionBusy, setNotionBusy] = useState(false);
  const [notionErr, setNotionErr] = useState<string | null>(null);
  const [notionPageUrl, setNotionPageUrl] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [targetPageInput, setTargetPageInput] = useState('');

  const markdown = buildDiaryMarkdown(scopedEntry);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let revoked = false;
    setImgLoading(true);
    setImgErr(null);
    renderDiaryImage(scopedEntry)
      .then((blob) => {
        if (revoked) return;
        setImgBlob(blob);
        setImgUrl(URL.createObjectURL(blob));
      })
      .catch(() => { if (!revoked) setImgErr('이미지를 만들지 못했어요. 다시 시도해 주세요.'); })
      .finally(() => { if (!revoked) setImgLoading(false); });
    return () => { revoked = true; };
  }, [scopedEntry]);

  useEffect(() => () => { if (imgUrl) URL.revokeObjectURL(imgUrl); }, [imgUrl]);

  useEffect(() => {
    if (tab !== 'notion') return;
    let active = true;
    setNotionLoading(true);
    setNotionErr(null);
    api.getNotionStatus()
      .then((s) => { if (active) setNotionStatus(s); })
      .catch(() => { if (active) setNotionErr('연결 상태를 불러오지 못했어요.'); })
      .finally(() => { if (active) setNotionLoading(false); });
    return () => { active = false; };
  }, [tab, api]);

  async function verifyToken(): Promise<boolean> {
    const token = tokenInput.trim();
    if (token.length === 0) {
      setNotionErr('노션 통합 토큰을 입력해 주세요.');
      return false;
    }
    setNotionBusy(true);
    setNotionErr(null);
    try {
      await api.verifyNotionToken(token);
      return true;
    } catch (e) {
      const code = (e as { code?: string })?.code;
      const detail = (e as { message?: string })?.message;
      setNotionErr(code === 'invalid_token'
        ? '토큰이 올바르지 않아요. 다시 확인해 주세요.'
        : (detail ? `토큰 검증 실패: ${detail}` : '토큰을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.'));
      return false;
    } finally {
      setNotionBusy(false);
    }
  }
  async function connectNotion() {
    if (notionBusy) return;
    const token = tokenInput.trim();
    if (token.length === 0) {
      setNotionErr('노션 통합 토큰을 입력해 주세요.');
      return;
    }
    setNotionBusy(true);
    setNotionErr(null);
    try {
      const status = await api.connectNotion(token, targetPageInput.trim() || undefined);
      setNotionStatus(status);
      setTokenInput('');
      setTargetPageInput('');
      if (status.hasTarget === false) {
        setNotionErr('연결됐지만 공유된 페이지가 없어요. 노션에서 통합에 페이지를 하나 이상 공유한 뒤 다시 연결해 주세요.');
      }
    } catch (e) {
      const code = (e as { code?: string })?.code;
      const detail = (e as { message?: string })?.message;
      if (code === 'invalid_token') {
        setNotionErr('토큰이 올바르지 않아요. 다시 확인해 주세요.');
      } else if (code === 'invalid_page_url' || code === 'notion_page_not_accessible') {
        setNotionErr(detail ?? '페이지 링크를 확인해 주세요.');
      } else {
        setNotionErr(detail ? `노션 연결 실패: ${detail}` : '노션 연결에 실패했어요. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setNotionBusy(false);
    }
  }
  async function disconnectNotion() {
    if (notionBusy) return;
    setNotionBusy(true);
    setNotionErr(null);
    try {
      await api.disconnectNotion();
      setNotionStatus({ connected: false });
      setNotionPageUrl(null);
    } catch {
      setNotionErr('연결 해제에 실패했어요.');
    } finally {
      setNotionBusy(false);
    }
  }
  async function exportNotion() {
    if (notionBusy) return;
    setNotionBusy(true);
    setNotionErr(null);
    setNotionPageUrl(null);
    try {
      const { url } = await api.exportDiaryToNotion(entry.diaryId);
      setNotionPageUrl(url);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === 'notion_reauth_required') {
        setNotionStatus({ connected: false });
        setNotionErr('노션 연결이 만료됐어요. 다시 연결해 주세요.');
      } else if (code === 'notion_no_target') {
        setNotionErr('노션에서 공유한 페이지가 없어요. 다시 연결하며 페이지를 선택해 주세요.');
      } else {
        setNotionErr('노션에 추가하지 못했어요. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setNotionBusy(false);
    }
  }

  function downloadMd() {
    const md = buildDiaryMarkdown(scopedEntry);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    saveBlob(blob, `${diaryFileBase(entry)}.md`);
  }
  function downloadImg() {
    if (!imgBlob) return;
    saveBlob(imgBlob, `${diaryFileBase(entry)}.png`);
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(0,0,0,0.4)' }}
    >
      <div style={{
        position: 'absolute', top: 0, left: offset.left, right: 0, bottom: offset.bottom,
        display: 'grid', placeItems: 'center', padding: 20,
      }}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ maxWidth: 560, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
        role="dialog"
        aria-modal="true"
        aria-label="일기 공유"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px 0' }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>공유하기</div>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{ width: 34, height: 34, borderRadius: 10, border: 'none', background: 'var(--surface-3)', color: 'var(--text-2)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '16px 22px 0' }}>
          <TabBtn active={tab === 'md'} onClick={() => setTab('md')} label="마크다운" sub=".md" />
          <TabBtn active={tab === 'image'} onClick={() => setTab('image')} label="이미지" sub=".png" />
          <TabBtn active={tab === 'notion'} onClick={() => setTab('notion')} label="노션" sub="페이지" />
        </div>

        {tab !== 'notion' && (
          <>
            <ScopeBar
              mode={scopeMode}
              lines={summaryLines}
              maxLines={maxLines}
              summaryActive={aiSummary !== null}
              summaryLoading={summaryLoading}
              onFull={selectFull}
              onSummary={selectSummary}
              onLinesChange={changeSummaryLines}
              onAiSummary={runAiSummary}
            />
            {summaryErr && (
              <div style={{ padding: '8px 22px 0', color: '#e03535', fontSize: 13 }}>{summaryErr}</div>
            )}
          </>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px', background: 'var(--surface-2)', margin: '14px 0 0' }}>
          {tab === 'md' ? (
            <MarkdownCodeView code={markdown} filename={`${diaryFileBase(entry)}.md`} />
          ) : tab === 'image' ? (
            <div style={{ display: 'grid', placeItems: 'center', minHeight: 220 }}>
              {imgLoading && <div style={{ color: 'var(--text-3)', fontSize: 14 }}>이미지 만드는 중…</div>}
              {imgErr && <div style={{ color: '#e03535', fontSize: 14 }}>{imgErr}</div>}
              {!imgLoading && !imgErr && imgUrl && (
                <img
                  src={imgUrl}
                  alt="공유 이미지 미리보기"
                  style={{ maxWidth: '100%', height: 'auto', borderRadius: 'var(--radius-m)', boxShadow: 'var(--shadow-card)' }}
                />
              )}
            </div>
          ) : (
            <NotionPane
              loading={notionLoading}
              status={notionStatus}
              busy={notionBusy}
              err={notionErr}
              pageUrl={notionPageUrl}
              markdown={markdown}
              tokenInput={tokenInput}
              onTokenChange={setTokenInput}
              targetPageInput={targetPageInput}
              onTargetPageChange={setTargetPageInput}
              onVerifyToken={verifyToken}
              onConnect={connectNotion}
              onDisconnect={disconnectNotion}
            />
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '16px 22px', borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-ghost btn-pill" onClick={onClose} style={{ flex: 2 }}>닫기</button>          {tab === 'md' && (
            <button className="btn btn-primary btn-pill" onClick={downloadMd} style={{ flex: 4 }}>
              <DownloadIcon /> 마크다운 다운로드
            </button>
          )}
          {tab === 'image' && (
            <button className="btn btn-primary btn-pill" onClick={downloadImg} disabled={!imgBlob} style={{ flex: 4 }}>
              <DownloadIcon /> 이미지 다운로드
            </button>
          )}
          {tab === 'notion' && notionStatus?.connected && (
            notionPageUrl ? (
              <a
                className="btn btn-primary btn-pill"
                href={notionPageUrl}
                target="_blank"
                rel="noreferrer"
                style={{ flex: 4, textDecoration: 'none' }}
              >
                <NotionIcon /> 노션에서 열기
              </a>
            ) : (
              <button className="btn btn-primary btn-pill" onClick={exportNotion} disabled={notionBusy} style={{ flex: 4 }}>
                <NotionIcon /> {notionBusy ? '추가하는 중…' : '노션에 추가'}
              </button>
            )
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

const CODE_FONT =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

function mdLineColor(line: string): string {
  const t = line.replace(/^\s+/, '');
  if (/^#{1,6}\s/.test(t)) return '#0550ae';
  if (/^>/.test(t)) return '#116329';
  if (/^-{3,}\s*$/.test(t)) return '#6e7781';
  if (/^#\S/.test(t)) return '#8250df';
  if (/^_.*_$/.test(t)) return '#6e7781';
  return '#24292f';
}

function MarkdownCodeView({ code, filename }: { code: string; filename: string }) {
  const lines = code.split('\n');
  return (
    <div style={{ borderRadius: 'var(--radius-m)', overflow: 'hidden', border: '1px solid #d0d7de', boxShadow: 'var(--shadow-card)' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', background: '#f6f8fa', borderBottom: '1px solid #d0d7de' }}>
        <span style={{ color: '#57606a', fontSize: 12.5, fontFamily: CODE_FONT }}>{filename}</span>
      </div>
      <div style={{ background: '#ffffff', overflowX: 'auto' }}>
        <pre style={{ margin: 0, padding: '14px 0', fontSize: 13, lineHeight: 1.7, fontFamily: CODE_FONT }}>
          {lines.map((line, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '46px 1fr' }}>
              <span style={{ textAlign: 'right', paddingRight: 14, color: '#b0b8c0', userSelect: 'none' }}>{i + 1}</span>
              <code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: mdLineColor(line), paddingRight: 16 }}>
                {line.length > 0 ? line : '\u00A0'}
              </code>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, label, sub }: { active: boolean; onClick: () => void; label: string; sub: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        height: 46,
        borderRadius: 12,
        border: active ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
        background: active ? 'var(--accent-soft)' : 'var(--surface)',
        color: active ? 'var(--accent)' : 'var(--text-2)',
        fontSize: 14.5,
        fontWeight: 700,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        transition: 'all 0.15s',
      }}
    >
      {label}
      <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.7 }}>{sub}</span>
    </button>
  );
}

function DownloadIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ScopeBar({
  mode,
  lines,
  maxLines,
  summaryActive,
  summaryLoading,
  onFull,
  onSummary,
  onLinesChange,
  onAiSummary,
}: {
  mode: 'full' | 'summary';
  lines: number;
  maxLines: number;
  summaryActive: boolean;
  summaryLoading: boolean;
  onFull: () => void;
  onSummary: () => void;
  onLinesChange: (n: number) => void;
  onAiSummary: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(lines));
  const clamp = (n: number) => Math.max(SUMMARY_MIN_LINES, Math.min(maxLines, n));
  const stepBtn: CSSProperties = {
    width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--surface)', color: 'var(--text-2)', cursor: 'pointer',
    fontSize: 16, fontWeight: 700, display: 'grid', placeItems: 'center', lineHeight: 1,
  };
  function commitDraft() {
    const n = Number(draft);
    onLinesChange(Number.isFinite(n) && n > 0 ? clamp(n) : lines);
    setEditing(false);
  }
  function startEdit() {
    setDraft(String(lines));
    setEditing(true);
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 22px 0', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-3)' }}>공유 범위</span>
      <button
        className={`chip${mode === 'full' ? ' chip-accent' : ''}`}
        onClick={onFull}
        style={{ cursor: 'pointer' }}
      >
        전문
      </button>
      <button
        className={`chip${mode === 'summary' ? ' chip-accent' : ''}`}
        onClick={onSummary}
        style={{ cursor: 'pointer' }}
      >
        요약
      </button>
      {mode === 'summary' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 2 }}>
          <button type="button" aria-label="줄 수 줄이기" style={stepBtn} onClick={() => onLinesChange(clamp(lines - 1))} disabled={lines <= SUMMARY_MIN_LINES}>−</button>
          {editing ? (
            <input
              type="number"
              min={SUMMARY_MIN_LINES}
              max={maxLines}
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitDraft();
                else if (e.key === 'Escape') setEditing(false);
              }}
              aria-label="요약 줄 수 입력"
              style={{
                width: 52, height: 30, textAlign: 'center', fontSize: 13.5, fontWeight: 700,
                color: 'var(--text)', background: 'var(--surface)',
                border: '1px solid var(--accent)', borderRadius: 8, MozAppearance: 'textfield',
              }}
            />
          ) : (
            <button
              type="button"
              onClick={startEdit}
              title="클릭해서 줄 수 입력"
              aria-label={`요약 줄 수 ${lines}줄, 최대 ${maxLines}줄, 클릭해서 변경`}
              style={{
                minWidth: 48, height: 30, padding: '0 8px', textAlign: 'center',
                fontSize: 13.5, fontWeight: 700, color: 'var(--text-2)', cursor: 'text',
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
              }}
            >
              {lines}줄
            </button>
          )}
          <button type="button" aria-label="줄 수 늘리기" style={stepBtn} onClick={() => onLinesChange(clamp(lines + 1))} disabled={lines >= maxLines}>+</button>
          <button
            type="button"
            className={`chip${summaryActive ? ' chip-accent' : ''}`}
            onClick={onAiSummary}
            disabled={summaryLoading}
            style={{ cursor: summaryLoading ? 'default' : 'pointer', marginLeft: 4, opacity: summaryLoading ? 0.6 : 1 }}
          >
            {summaryLoading ? '요약 중…' : summaryActive ? 'AI 요약 해제' : 'AI 요약'}
          </button>
        </div>
      )}
    </div>
  );
}

function NotionIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
      <path d="M9 8v8m0-8 6 8m0-8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function NotionPane({
  loading,
  status,
  busy,
  err,
  pageUrl,
  markdown,
  tokenInput,
  onTokenChange,
  targetPageInput,
  onTargetPageChange,
  onVerifyToken,
  onConnect,
  onDisconnect,
}: {
  loading: boolean;
  status: NotionStatus | null;
  busy: boolean;
  err: string | null;
  pageUrl: string | null;
  markdown: string;
  tokenInput: string;
  onTokenChange: (v: string) => void;
  targetPageInput: string;
  onTargetPageChange: (v: string) => void;
  onVerifyToken: () => Promise<boolean>;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const connected = status?.connected === true;
  const [step, setStep] = useState<'token' | 'page'>('token');
  useEffect(() => { if (connected) setStep('token'); }, [connected]);

  const contentPreview = (
    <div
      className="md-preview"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-m)', padding: '22px 24px 26px', maxHeight: 320, overflowY: 'auto' }}
    >
      {renderMarkdown(markdown)}
    </div>
  );

  return (
    <div
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-m)', padding: '24px 24px', minHeight: 220, display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--surface-3)', color: 'var(--text)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <NotionIcon />
        </div>
        <div style={{ fontSize: 16, fontWeight: 800 }}>
          {loading ? '연결 상태 확인 중…' : pageUrl ? '노션에 추가했어요' : connected ? '노션이 연결됐어요' : '노션에 일기 저장하기'}
        </div>
      </div>

      {loading ? null : pageUrl ? (
        <>
          {contentPreview}
          <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>
            아래 <b>노션에서 열기</b>로 방금 만든 페이지를 확인할 수 있어요.
          </div>
        </>
      ) : connected ? (
        <>
          {contentPreview}
          <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>
            {status?.workspaceName ? <><b>{status.workspaceName}</b> 워크스페이스</> : '워크스페이스'}
            {status?.targetPageTitle ? <> · <b>{status.targetPageTitle}</b> 하위에 추가돼요.</> : ''}
            <br />아래 <b>노션에 추가</b>를 누르면 이 일기가 새 페이지로 만들어져요.
          </div>
          <button
            onClick={onDisconnect}
            disabled={busy}
            style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
          >
            연결 해제
          </button>
        </>
      ) : step === 'token' ? (
        <>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.7 }}>
            <li><a href="https://www.notion.so/my-integrations" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>notion.so/my-integrations</a> → <b>신규 연결</b>에서 인증 방법을 <b>액세스 토큰</b>으로 고르고, 워크스페이스를 선택해 <b>연결 생성하기</b>를 눌러요.</li>
            <li>생성된 연결의 <b>액세스 토큰(Internal Integration Secret)</b>을 복사해요.</li>
          </ol>
          <input
            className="input"
            type="password"
            value={tokenInput}
            onChange={(e) => onTokenChange(e.target.value)}
            placeholder="ntn_… 통합 토큰 붙여넣기"
            aria-label="노션 통합 토큰"
            autoComplete="off"
            style={{ height: 48 }}
          />
          <button
            className="btn btn-primary btn-pill"
            onClick={() => { void onVerifyToken().then((ok) => { if (ok) setStep('page'); }); }}
            disabled={busy || tokenInput.trim().length === 0}
            style={{ alignSelf: 'flex-start' }}
          >
            <NotionIcon /> {busy ? '확인 중…' : '다음'}
          </button>
        </>
      ) : (
        <>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>저장할 페이지 추가하기</div>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.7 }}>
            <li>노션에서 일기를 저장할 <b>페이지를 열거나 새로 만들어요</b>.</li>
            <li>페이지 오른쪽 위 <b>···</b>를 누르고 <b>맨 아래로 스크롤</b>해 <b>연결</b>(또는 <b>연결 추가 / Connect to</b>)을 찾아요.</li>
            <li>1단계에서 만든 <b>통합 이름을 검색</b>해 선택하면 그 페이지에 연결돼요.</li>
            <li>다시 <b>···</b> 메뉴 → <b>링크 복사(Ctrl+Alt+L)</b>로 페이지 링크를 복사해요.</li>
            <li>아래에 붙여넣고 <b>연결하기</b>를 눌러요.</li>
          </ol>
          <input
            className="input"
            type="text"
            value={targetPageInput}
            onChange={(e) => onTargetPageChange(e.target.value)}
            placeholder="https://www.notion.so/… 페이지 링크 붙여넣기"
            aria-label="노션 저장 페이지 링크"
            autoComplete="off"
            style={{ height: 48 }}
          />
          <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5, marginTop: -6 }}>
            통합을 추가하지 않은 페이지는 접근할 수 없어요. 링크를 비워두면 통합에 공유된 첫 페이지가 자동으로 선택돼요.
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn btn-ghost btn-pill"
              onClick={() => setStep('token')}
              disabled={busy}
            >
              이전
            </button>
            <button className="btn btn-primary btn-pill" onClick={onConnect} disabled={busy}>
              <NotionIcon /> {busy ? '연결 중…' : '연결하기'}
            </button>
          </div>
        </>
      )}

      {err && <div style={{ color: '#e03535', fontSize: 13.5, lineHeight: 1.5 }}>{err}</div>}
    </div>
  );
}
