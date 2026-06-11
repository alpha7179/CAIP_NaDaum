// 홈 + 대화 화면 통합 (idle/talking 상태 전환)
import type { DiaryEntry } from '@nadaum/shared';
import type { RiskLevel } from '@nadaum/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { AvailableModel } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { WaveOrb } from '../components/WaveOrb';
import { SAMPLE_DIARY } from '../data/sampleDiary';

import { DiaryCardRow } from './HomePage';


const MODEL_STORAGE_KEY = 'nadaum.model';

function providerColor(provider: string): string {
  if (provider === 'anthropic') return '#c47b2b';
  if (provider === 'google')    return '#1a73e8';
  if (provider === 'xai')       return '#111';
  return '#1faa6a';
}

type GoFn = (r: string, p?: string) => void;

interface Msg { from: 'ai' | 'me'; text: string }

function hourGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return '고요한 새벽이에요';
  if (h < 12) return '좋은 아침이에요';
  if (h < 18) return '나른한 오후예요';
  if (h < 22) return '하루를 마무리할 시간이에요';
  return '깊은 밤이에요';
}

export function HomeChatPage({ go, startTalking = false }: { go: GoFn; startTalking?: boolean }) {
  const { name, api, isAdmin } = useAuth();
  const nm = name ?? '다움';

  const [diaries, setDiaries] = useState<DiaryEntry[]>([]);

  useEffect(() => {
    api.listDiaries(0)
      .then((res) => setDiaries(res.items.slice(0, 3)))
      .catch(() => {});
  }, [api]);

  const [models, setModels] = useState<AvailableModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(
    () => localStorage.getItem(MODEL_STORAGE_KEY) ?? '',
  );

  useEffect(() => {
    api.getModels().then((res) => {
      setModels(res.models);
      if (res.models.length > 0 && !res.models.some((m) => m.id === selectedModel)) {
        setSelectedModel(res.models[0]!.id);
      }
    }).catch(() => {});
  }, [api]);

  const explicitPickRef = useRef(false);
  function pickModel(id: string) {
    setSelectedModel(id);
    explicitPickRef.current = true;
    localStorage.setItem(MODEL_STORAGE_KEY, id);
  }

  const [talking, setTalking] = useState(startTalking);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [listening, setListening] = useState(false);
  const [showKb, setShowKb] = useState(false);
  const [draft, setDraft] = useState('');
  const [writing, setWriting] = useState(false);
  const [risk, setRisk] = useState<RiskLevel | undefined>();
  const [done, setDone] = useState(false);
  const chatBodyRef = useRef<HTMLDivElement>(null);

  function startChat() {
    setTalking(true);
    if (sessionId !== undefined) return;
    const modelArg = explicitPickRef.current ? (selectedModel || undefined) : undefined;
    api.startSession(modelArg)
      .then((res) => {
        setSessionId(res.sessionId);
        if (res.model) {
          setSelectedModel(res.model);
          localStorage.setItem(MODEL_STORAGE_KEY, res.model);
        }
        setMessages([{ from: 'ai', text: '안녕하세요. 오늘 하루는 어땠어요? 편하게 이야기해 주세요.' }]);
      })
      .catch(() => {
        setMessages([{ from: 'ai', text: '잠시 오류가 생겼어요. 잠시 후 다시 시도해 주세요.' }]);
      });
  }

  useEffect(() => {
    if (startTalking) startChat();
  }, [startTalking]);

  useEffect(() => {
    if (!talking) return;
    if (chatBodyRef.current)
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight + 300;
  }, [messages, typing, listening, talking]);

  const sendText = useCallback(async (text: string) => {
    if (!text.trim() || !sessionId || done) return;
    setMessages((prev) => [...prev, { from: 'me', text }]);
    setDraft('');
    setTyping(true);
    try {
      const res = await api.sendUtterance(sessionId, { text });
      setTyping(false);
      setMessages((prev) => [...prev, { from: 'ai', text: res.aiResponse }]);
      setRisk(res.riskLevel);
      if (res.forceFinalize || res.stage === '부드러운마무리') setDone(true);
    } catch {
      setTyping(false);
      setMessages((prev) => [...prev, { from: 'ai', text: '잠시 오류가 생겼어요. 다시 한 번 말씀해 주실 수 있을까요?' }]);
    }
  }, [api, sessionId, done]);

  function tapMic() {
    if (done || listening || typing) return;
    setListening(true);
    setTimeout(() => {
      setListening(false);
      void sendText('(음성 입력)');
    }, 1700);
  }

  function finalize() {
    setWriting(true);
    const end = async () => {
      if (sessionId) {
        try { await api.endSession(sessionId, 'user'); } catch {}
      }
      go('diary');
    };
    setTimeout(() => { void end(); }, 2600);
  }

  function goHome() {
    if (sessionId) {
      void api.endSession(sessionId, 'user').catch(() => {});
    }
    setTalking(false);
    setSessionId(undefined);
    setMessages([]);
    setTyping(false);
    setListening(false);
    setShowKb(false);
    setDraft('');
    setDone(false);
    setRisk(undefined);
  }

  const showDiaries = diaries.length > 0;

  return (
    <div className={`hcp-root ${talking ? 'talking' : 'idle'}`}>

      <div className="hcp-hero">
        <div className="hcp-greeting">
          <div className="eyebrow">{hourGreeting()}</div>
          <h1 className="greet" style={{ marginTop: 10, fontSize: 'clamp(22px, 3.2vw, 32px)' }}>
            {nm}님,<br />오늘의 <span className="accent">나</span>를 들려주세요
          </h1>
        </div>

        <div className="hcp-orb-wrap">
          <WaveOrb size={220} active={listening || typing} />
        </div>

        <div className="hcp-status">
          {listening ? '지금 말하고 있어요' : typing ? '생각 중…' : `${nm}님, 오늘 하루를 들려주세요`}
        </div>

        {isAdmin && models.length > 0 && (
          <div className="hcp-cta" style={{ flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center' }}>
              {models.map((m) => (
                <button
                  key={m.id}
                  onClick={() => pickModel(m.id)}
                  className={`chip${selectedModel === m.id ? ' chip-accent' : ''}`}
                  style={{ height: 30, fontSize: 13, fontWeight: selectedModel === m.id ? 700 : 400, cursor: 'pointer', border: `1.5px solid ${selectedModel === m.id ? 'var(--accent)' : 'transparent'}` }}
                  title={m.description}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: providerColor(m.provider), flexShrink: 0 }} />
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="hcp-cta">
          <button className="btn btn-primary btn-pill" onClick={startChat}>
            <Icon.chat width={18} height={18} /> 대화 시작하기
          </button>
        </div>
      </div>

      <div className="hcp-home-body">
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, marginTop: 8 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>
              {showDiaries ? '최근 일기' : '예시 일기'}
            </h3>
            <a className="back-btn" onClick={() => go('diary')}>
              전체보기 <Icon.arrow width={14} height={14} />
            </a>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 24 }}>
            {showDiaries
              ? diaries.map((d) => <DiaryCardRow key={d.diaryId} d={d} go={go} />)
              : SAMPLE_DIARY.slice(0, 2).map((d) => <DiaryCardRow key={d.id} d={d} go={go} />)}
          </div>
        </div>
      </div>

      <div className="hcp-chat-body" ref={chatBodyRef}>
        <div className="convo-inner" style={{ maxWidth: 680 }}>

          {risk === '고위험' && (
            <div className="card fade" style={{ padding: 20, background: '#fff0f0', border: '1.5px solid #f88', borderRadius: 18, textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#c80000', marginBottom: 8 }}>지금 많이 힘드신가요?</div>
              <a href="tel:1393" className="btn btn-primary btn-pill" style={{ display: 'inline-flex', height: 44, fontSize: 15 }}>
                자살예방상담전화 1393
              </a>
            </div>
          )}

          {messages.map((m, i) => (
            <div className="msg-row" key={i} style={{ alignItems: m.from === 'me' ? 'flex-end' : 'flex-start' }}>
              <div className={`bubble ${m.from === 'me' ? 'bubble-me' : 'bubble-ai'}`}>{m.text}</div>
            </div>
          ))}

          {typing && (
            <div className="msg-row" style={{ alignItems: 'flex-start' }}>
              <div className="bubble bubble-ai">
                <span className="typing"><i /><i /><i /></span>
              </div>
            </div>
          )}

          {done && !writing && (
            <div className="card fade" style={{ padding: 22, marginTop: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 14.5, color: 'var(--text-2)', marginBottom: 14, lineHeight: 1.6 }}>
                오늘 대화가 충분히 모였어요.<br />이 이야기를 한 편의 일기로 정리해 드릴까요?
              </div>
              <button className="btn btn-primary btn-pill" onClick={finalize}>
                <Icon.spark /> 일기로 정리하기
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="hcp-dock">
        {!done ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', maxWidth: 560, justifyContent: 'center' }}>
              <button
                className={`mic-btn${listening ? ' live' : ''}`}
                onClick={tapMic}
                aria-label="말하기"
              >
                <Icon.mic />
              </button>
              <button
                onClick={goHome}
                style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--surface-3)', border: '1px solid var(--border)', display: 'grid', placeItems: 'center', color: 'var(--text-2)', flexShrink: 0 }}
                aria-label="홈으로"
                title="홈으로"
              >
                <Icon.back />
              </button>
            </div>

            <div className="dock-hint">
              {listening ? '지금 말하고 있어요' : '버튼을 누르고 오늘 있었던 일을 들려주세요'}
            </div>

            {!showKb
              ? <button className="chip" onClick={() => setShowKb(true)} style={{ cursor: 'pointer' }}>키보드로 입력하기</button>
              : (
                <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 560 }}>
                  <input
                    className="input"
                    style={{ height: 50 }}
                    autoFocus
                    placeholder="직접 입력해 보세요"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void sendText(draft); }}
                  />
                  <button className="btn btn-primary" style={{ height: 50, padding: '0 18px' }} onClick={() => void sendText(draft)}>
                    <Icon.arrow />
                  </button>
                </div>
              )}
          </>
        ) : (
          <div className="dock-hint">대화가 마무리됐어요 🌙</div>
        )}
      </div>

      {writing && (
        <div className="hcp-writing">
          <WaveOrb size={200} active intensity={1.4} />
          <div style={{ marginTop: 14, fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>오늘을 일기로 옮기고 있어요</div>
          <div style={{ marginTop: 8, color: 'var(--text-2)', fontSize: 14.5 }}>당신의 말투를 닮은 한 편의 글로요…</div>
        </div>
      )}
    </div>
  );
}
