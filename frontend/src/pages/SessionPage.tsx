// 대화 세션 화면 (세션 API 연결, 마이크/텍스트 입력)
import type { RiskLevel } from '@nadaum/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { AvailableModel, UtteranceResponse } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { SafetyOverlay } from '../components/SafetyOverlay';
import { WaveOrb } from '../components/WaveOrb';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';

const MODEL_STORAGE_KEY = 'nadaum.model';

const MODEL_PICKER_DISABLED = false;

const MIC_DISABLED = true;

function providerColor(provider: string): string {
  if (provider === 'anthropic') return '#c47b2b';
  if (provider === 'google')    return '#1a73e8';
  if (provider === 'xai')       return '#111';
  return '#1faa6a';
}

type GoFn = (r: string, p?: string) => void;

const HIGH_RISK_STOP_THRESHOLD = 2;

function hourGreet(): string {
  const h = new Date().getHours();
  if (h < 6) return '고요한 새벽이에요';
  if (h < 12) return '좋은 아침이에요';
  if (h < 18) return '나른한 오후예요';
  if (h < 22) return '하루를 마무리할 시간이에요';
  return '깊은 밤이에요';
}

interface Msg { from: 'ai' | 'me' | 'risk'; text?: string }

function RiskBanner({ onShow }: { onShow: () => void }) {
  return (
    <div className="card fade" style={{ padding: 18, background: '#fff0f0', border: '1.5px solid #f88', borderRadius: 18, textAlign: 'center', margin: '4px 0' }}>
      <div style={{ fontWeight: 800, fontSize: 15.5, color: '#c80000', marginBottom: 8 }}>지금 많이 힘드신가요?</div>
      <div style={{ fontSize: 14, color: '#333', marginBottom: 12, lineHeight: 1.6 }}>
        혼자 견디지 않으셔도 괜찮아요. 전문 상담사가 24시간 무료로 도와드려요.
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        <a href="tel:1393" className="btn btn-pill" style={{ display: 'inline-flex', background: '#e03535', color: '#fff', boxShadow: '0 6px 16px rgba(224,53,53,0.38)' }}>자살예방상담 1393</a>
        <a href="tel:1577-0199" className="btn btn-pill" style={{ display: 'inline-flex', background: '#fff', color: 'var(--text)', border: '1px solid var(--border)', boxShadow: '0 6px 16px rgba(20,30,55,0.14)' }}>정신건강위기상담 1577-0199</a>
      </div>
      <button
        onClick={onShow}
        style={{ marginTop: 10, background: 'none', border: 'none', color: '#c80000', fontSize: 13, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}
      >
        상담 안내 다시 보기
      </button>
    </div>
  );
}

export function SessionPage({ go }: { go: GoFn }) {
  const { name, api, isAdmin } = useAuth();
  const nm = name || '나';

  const [models, setModels] = useState<AvailableModel[]>([]);
  const [activeModel, setActiveModel] = useState<string>(
    () => localStorage.getItem(MODEL_STORAGE_KEY) ?? '',
  );
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [pendingModelId, setPendingModelId] = useState<string | undefined>();

  useEffect(() => {
    api.getModels().then((res) => {
      setModels(res.models);
      if (res.models.length > 0 && !res.models.some((m) => m.id === activeModel)) {
        setActiveModel(res.models[0]!.id);
      }
    }).catch(() => {});
  }, [api]);

  const [sessionId, setSessionId] = useState<string | undefined>();
  const sessionIdRef = useRef<string | undefined>(undefined);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [showKb, setShowKb] = useState(true);
  const [draft, setDraft] = useState('');
  const [writing, setWriting] = useState(false);
  const [risk, setRisk] = useState<RiskLevel | undefined>();
  const [safetyOpen, setSafetyOpen] = useState(false);
  const safetyShownRef = useRef(false);
  const highRiskWordCountRef = useRef(0);
  const endedRef = useRef(false);
  const hadUserMsgRef = useRef(false);
  const [stopped, setStopped] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const TA_LINE = 22;
  const TA_PAD_Y = 14;
  const TA_MAX = TA_LINE * 3 + TA_PAD_Y * 2;
  const autoResize = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, TA_MAX)}px`;
    el.style.overflowY = el.scrollHeight > TA_MAX ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    sessionIdRef.current = sessionId;
    if (sessionId) { endedRef.current = false; hadUserMsgRef.current = false; }
  }, [sessionId]);

  useEffect(() => {
    if (messages.some((m) => m.from === 'me')) hadUserMsgRef.current = true;
  }, [messages]);

  useEffect(() => {
    const endIfNeeded = (useBeacon: boolean): void => {
      const id = sessionIdRef.current;
      if (id === undefined || endedRef.current || !hadUserMsgRef.current) return;
      endedRef.current = true;
      if (useBeacon) api.endSessionBeacon(id, 'user');
      else void api.endSession(id, 'user').catch(() => {});
    };
    const onPageHide = (): void => endIfNeeded(true);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      endIfNeeded(false);
    };
  }, []);

  const voice = useVoiceRecorder();
  const speech = useSpeechRecognition();
  const listening = voice.isRecording || speech.listening;

  useEffect(() => {
    let active = true;
    api.startSession(undefined)
      .then((res) => {
        if (!active) return;
        setSessionId(res.sessionId);
        if (res.model) {
          setActiveModel(res.model);
          localStorage.setItem(MODEL_STORAGE_KEY, res.model);
        }
        setMessages([{ from: 'ai', text: '안녕하세요. 오늘 하루는 어땠어요? 편하게 이야기해 주세요.' }]);
      })
      .catch(() => {
        if (!active) return;
        setError('세션을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.');
      });
    return () => { active = false; };
  }, [api]);

  async function doModelSwitch(newModelId: string, endCurrent: boolean) {
    setRestarting(true);
    if (listening) { voice.cancel(); void speech.stop(); }
    const curId = sessionIdRef.current;
    if (curId && endCurrent) { try { await api.endSession(curId, 'user'); } catch {} endedRef.current = true; }
    setSessionId(undefined);
    setMessages([]);
    setTyping(false);
    setDraft('');
    setRisk(undefined);
    setSafetyOpen(false);
    safetyShownRef.current = false;
    highRiskWordCountRef.current = 0;
    setStopped(false);
    setDone(false);
    setError('');
    localStorage.setItem(MODEL_STORAGE_KEY, newModelId);
    try {
      const res = await api.startSession(newModelId);
      setSessionId(res.sessionId);
      setActiveModel(res.model ?? newModelId);
      setMessages([{ from: 'ai', text: '안녕하세요. 오늘 하루는 어땠어요? 편하게 이야기해 주세요.' }]);
    } catch {
      setError('세션을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setRestarting(false);
    }
  }

  function pickModel(newModelId: string) {
    if (newModelId === activeModel || restarting) return;
    setModelPickerOpen(false);
    if (messages.some((m) => m.from === 'me')) {
      setPendingModelId(newModelId);
      return;
    }
    void doModelSwitch(newModelId, false);
  }

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight + 300;
  }, [messages, typing, listening, speech.interim]);

  useEffect(() => { autoResize(); }, [draft, showKb, autoResize]);

  const modelLocked = MODEL_PICKER_DISABLED || restarting || typing || transcribing || listening;
  useEffect(() => {
    if (modelLocked) setModelPickerOpen(false);
  }, [modelLocked]);

  useEffect(() => {
    if (risk === '고위험') {
      if (!safetyShownRef.current) { setSafetyOpen(true); safetyShownRef.current = true; }
    } else {
      safetyShownRef.current = false;
    }
  }, [risk]);

  const applyRisk = useCallback((riskLevel: RiskLevel) => {
    setRisk(riskLevel);
    if (riskLevel === '고위험') {
      highRiskWordCountRef.current += 1;
      if (highRiskWordCountRef.current >= HIGH_RISK_STOP_THRESHOLD) {
        setStopped(true);
        setDone(true);
        setSafetyOpen(true);
      }
    }
  }, []);

  const handleAiResponse = useCallback((res: UtteranceResponse, myText: string) => {
    const isHigh = res.riskLevel === '고위험';
    setMessages((prev) => isHigh
      ? [...prev, { from: 'me', text: myText }, { from: 'risk' }, { from: 'ai', text: res.aiResponse }]
      : [...prev, { from: 'me', text: myText }, { from: 'ai', text: res.aiResponse }]);
    applyRisk(res.riskLevel);
    if (res.forceFinalize) setDone(true);
  }, [applyRisk]);

  const sendText = useCallback(async (text: string) => {
    if (!text.trim() || !sessionId || done || typing || transcribing) return;
    setMessages((prev) => [...prev, { from: 'me', text }]);
    setDraft('');
    setTyping(true);
    try {
      const res = await api.sendUtterance(sessionId, { text });
      setTyping(false);
      const isHigh = res.riskLevel === '고위험';
      setMessages((prev) => isHigh
        ? [...prev, { from: 'risk' }, { from: 'ai', text: res.aiResponse }]
        : [...prev, { from: 'ai', text: res.aiResponse }]);
      applyRisk(res.riskLevel);
      if (res.forceFinalize) setDone(true);
    } catch {
      setTyping(false);
      setMessages((prev) => [...prev, { from: 'ai', text: '잠시 오류가 생겼어요. 다시 한 번 말씀해 주실 수 있을까요?' }]);
    }
  }, [api, sessionId, done, typing, transcribing, applyRisk]);

  const tapMic = useCallback(async () => {
    if (done || typing || transcribing) return;

    if (!listening) {
      if (speech.supported) {
        const ok = speech.start();
        if (ok) { void voice.start(); return; }
      }
      const ok = await voice.start();
      if (!ok) setShowKb(true);
      return;
    }

    if (speech.supported && speech.listening) {
      const text = await speech.stop();
      voice.cancel();
      if (text.trim().length > 0) {
        void sendText(text);
      } else {
        setMessages((prev) => [...prev, { from: 'ai', text: '잘 못 들었어요. 다시 말씀해 주시거나 키보드로 입력해 주세요.' }]);
      }
      return;
    }

    const result = await voice.stop();
    if (!result || !sessionId) return;
    setTranscribing(true);
    setTyping(true);
    try {
      const res = await api.sendUtterance(sessionId, {
        audioBase64: result.audioBase64,
        contentType: result.contentType,
        sampleRate: 16000,
        channels: 1,
        durationSec: result.durationSec,
      });
      setTyping(false);
      handleAiResponse(res, res.transcript || '(음성)');
    } catch {
      setTyping(false);
      setMessages((prev) => [...prev, { from: 'ai', text: '음성을 잘 못 들었어요. 다시 말씀해 주시거나 키보드로 입력해 주세요.' }]);
      setShowKb(true);
    } finally {
      setTranscribing(false);
    }
  }, [done, typing, transcribing, listening, speech, voice, sessionId, api, handleAiResponse, sendText]);

  function finalize() {
    endedRef.current = true;
    setWriting(true);
    const end = async () => {
      let diaryId: string | undefined;
      if (sessionId) {
        try {
          await api.endSession(sessionId, 'user');
          const list = await api.listDiaries(0);
          diaryId = list.items[0]?.diaryId;
        } catch {}
      }
      if (diaryId) go('detail', diaryId);
      else go('diary');
    };
    setTimeout(() => { void end(); }, 2600);
  }

  const currentModel = models.find((m) => m.id === activeModel);
  const currentModelLabel = currentModel?.label ?? activeModel;

  return (
    <div className="convo">
      <div className="convo-body" ref={bodyRef}>

        <div className="convo-inner">
          <div className="convo-hero">
            <WaveOrb size={150} active={listening || typing} intensity={listening ? 0.5 + voice.amplitude * 1.6 : 1} />
            <div className="convo-greet">{hourGreet()}</div>
            <div className="convo-greet-main">{nm}님, 오늘 하루를<br />편하게 들려주세요</div>
          </div>

          {error && (
            <div style={{ textAlign: 'center', color: 'var(--text-2)', padding: '20px 0' }}>{error}</div>
          )}

          {messages.map((m, i) => (
            m.from === 'risk' ? (
              <RiskBanner key={i} onShow={() => setSafetyOpen(true)} />
            ) : (
              <div className="msg-row" key={i} style={{ alignItems: m.from === 'me' ? 'flex-end' : 'flex-start' }}>
                <div className={`bubble ${m.from === 'me' ? 'bubble-me' : 'bubble-ai'}`}>{m.text}</div>
              </div>
            )
          ))}
          {speech.listening && speech.interim.length > 0 && (
            <div className="msg-row" style={{ alignItems: 'flex-end' }}>
              <div className="bubble bubble-me" style={{ opacity: 0.6 }}>{speech.interim}</div>
            </div>
          )}
          {typing && (
            <div className="msg-row" style={{ alignItems: 'flex-start' }}>
              <div className="bubble bubble-ai">
                <span className="typing"><i /><i /><i /></span>
              </div>
            </div>
          )}
          {done && !writing && (
            stopped ? (
              <div className="card fade" style={{ padding: 22, marginTop: 8, textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: 15.5, color: '#c80000', marginBottom: 8 }}>
                  안전을 위해 대화를 멈췄어요
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.6 }}>
                  지금은 전문 상담의 도움이 필요해 보여요. 위의 상담 번호로 꼭 연락해 주세요.
                  여기까지의 이야기는 일기로 정리해 드릴게요.
                </div>
                <button className="btn btn-primary btn-pill" onClick={finalize}>
                  <Icon.spark /> 여기까지 일기로 정리하기
                </button>
              </div>
            ) : (
              <div className="card fade" style={{ padding: 22, marginTop: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 14.5, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.6 }}>
                  오늘 이야기를 한 편의 일기로 정리해 드릴까요?
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button className="btn btn-ghost btn-pill" onClick={() => setDone(false)}>
                    더 이야기하기
                  </button>
                  <button className="btn btn-primary btn-pill" onClick={finalize}>
                    <Icon.spark /> 일기로 정리하기
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      <div className="convo-bottom">
      {!done && !writing && !error && (
        <div className="convo-endbar">
          <button
            className="convo-end-btn"
            onClick={() => { if (listening) voice.cancel(); setDone(true); }}
            disabled={messages.length < 2 || typing || transcribing}
          >
            <Icon.spark width={16} height={16} /> 대화 마치기
          </button>
        </div>
      )}

      <div className="voice-dock">
        {!done && !error && (
          <>
            {!showKb && (
              <div className="mic-row">
                {isAdmin && models.length > 0 && !listening && (
                  <div style={{ position: 'absolute', right: 'calc(50% + 46px)', bottom: 0 }}>
                    <button
                      onClick={() => setModelPickerOpen((o) => !o)}
                      disabled={modelLocked}
                      aria-label="AI 모델 선택"
                      title={MODEL_PICKER_DISABLED ? 'AI 모델 선택 (준비 중)' : (models.find((m) => m.id === activeModel)?.label ?? '모델 선택')}
                      style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--surface-3)', color: 'var(--text-2)', border: 'none', cursor: modelLocked ? 'not-allowed' : 'pointer', display: 'grid', placeItems: 'center', position: 'relative', transition: 'background 0.15s, color 0.15s, opacity 0.15s', opacity: modelLocked ? 0.35 : 1 }}
                    >
                      {restarting ? (
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', display: 'block', animation: 'pulse 1s infinite' }} />
                      ) : (
                        <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <rect x="6" y="6" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
                            <path d="M9 6V4M12 6V4M15 6V4M9 18v2M12 18v2M15 18v2M6 9H4M6 12H4M6 15H4M18 9h2M18 12h2M18 15h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                          <span style={{ position: 'absolute', bottom: -3, right: -3, width: 6, height: 6, borderRadius: '50%', background: providerColor(models.find((m) => m.id === activeModel)?.provider ?? ''), border: '1.5px solid var(--surface-3)' }} />
                        </span>
                      )}
                    </button>
                    {modelPickerOpen && !restarting && (
                      <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: 6, boxShadow: '0 12px 40px rgba(0,0,0,0.16)', zIndex: 20, minWidth: 210, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {models.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => void pickModel(m.id)}
                            title={m.description}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: 44, padding: '0 14px', background: activeModel === m.id ? 'var(--accent-soft)' : 'transparent', color: activeModel === m.id ? 'var(--accent)' : 'var(--text)', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: activeModel === m.id ? 700 : 400, cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap' }}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: providerColor(m.provider), flexShrink: 0 }} />
                              {m.label}
                            </span>
                            {activeModel === m.id && (
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                                <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <button
                  className={`mic-btn${listening ? ' live' : ''}`}
                  onClick={() => void tapMic()}
                  disabled={transcribing}
                  aria-label={listening ? '녹음 종료' : '말하기'}
                >
                  {listening ? (
                    <span style={{ width: 20, height: 20, borderRadius: 5, background: '#fff', display: 'block' }} />
                  ) : (
                    <Icon.mic />
                  )}
                </button>
                {!listening && (
                  <button className="mic-kb-btn" onClick={() => setShowKb(true)} aria-label="키보드로 입력하기" title="키보드로 입력하기">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <rect x="2.5" y="6" width="19" height="12" rx="2" stroke="currentColor" strokeWidth="1.9"/>
                      <path d="M6 9.5h.01M9 9.5h.01M12 9.5h.01M15 9.5h.01M18 9.5h.01M6 12.5h.01M18 12.5h.01M8.5 15.5h7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/>
                    </svg>
                  </button>
                )}
              </div>
            )}
            {!showKb && (
              <div className="dock-hint">
                {transcribing ? '듣고 있어요…'
                  : listening ? '🎙 듣고 있어요 · 말이 끝나면 버튼을 다시 눌러주세요'
                  : (voice.permissionDenied || speech.permissionDenied) ? '마이크 권한이 없어요. 키보드로 입력해 주세요.'
                  : '버튼을 누르고 오늘 있었던 일을 들려주세요'}
              </div>
            )}
            {showKb && (
              <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 560 }}>
                {isAdmin && models.length > 0 && (
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <button
                      onClick={() => setModelPickerOpen((o) => !o)}
                      disabled={modelLocked}
                      aria-label="AI 모델 선택"
                      title={MODEL_PICKER_DISABLED ? 'AI 모델 선택 (준비 중)' : (models.find((m) => m.id === activeModel)?.label ?? '모델 선택')}
                      style={{ width: 50, height: 50, borderRadius: 14, background: 'var(--surface-3)', color: 'var(--text-2)', border: 'none', cursor: modelLocked ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0, transition: 'opacity 0.15s', opacity: modelLocked ? 0.35 : 1 }}
                    >
                      {restarting ? (
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', display: 'block', animation: 'pulse 1s infinite' }} />
                      ) : (
                        <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <rect x="6" y="6" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
                            <path d="M9 6V4M12 6V4M15 6V4M9 18v2M12 18v2M15 18v2M6 9H4M6 12H4M6 15H4M18 9h2M18 12h2M18 15h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                          <span style={{ position: 'absolute', bottom: -3, right: -3, width: 7, height: 7, borderRadius: '50%', background: providerColor(models.find((m) => m.id === activeModel)?.provider ?? ''), border: '1.5px solid var(--surface-3)' }} />
                        </span>
                      )}
                    </button>
                    {modelPickerOpen && !restarting && (
                      <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: 6, boxShadow: '0 12px 40px rgba(0,0,0,0.16)', zIndex: 20, minWidth: 210, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {models.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => void pickModel(m.id)}
                            title={m.description}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: 44, padding: '0 14px', background: activeModel === m.id ? 'var(--accent-soft)' : 'transparent', color: activeModel === m.id ? 'var(--accent)' : 'var(--text)', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: activeModel === m.id ? 700 : 400, cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap' }}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: providerColor(m.provider), flexShrink: 0 }} />
                              {m.label}
                            </span>
                            {activeModel === m.id && (
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                                <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="chat-input-wrap">
                  <textarea
                    ref={taRef}
                    className="chat-textarea"
                    rows={1}
                    style={{
                      height: 50,
                      width: '100%',
                      resize: 'none',
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      lineHeight: `${TA_LINE}px`,
                      padding: `${TA_PAD_Y}px 18px`,
                      paddingRight: (currentModelLabel && draft.length === 0 ? Math.round(34 + currentModelLabel.length * 7) : 14) + (MIC_DISABLED ? 0 : 44),
                      overflowY: 'hidden',
                      display: 'block',
                      fontFamily: 'inherit',
                      fontSize: 16,
                      color: 'var(--text)',
                    }}
                    autoFocus
                    placeholder="직접 입력해 보세요"
                    value={draft}
                    onChange={(e) => { setDraft(e.target.value); autoResize(); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!typing && !transcribing) void sendText(draft); }
                    }}
                  />
                  {currentModelLabel && draft.length === 0 && (
                    <span
                      className="field-model-badge"
                      style={{ right: MIC_DISABLED ? 12 : 50, bottom: 11, top: 'auto', transform: 'none' }}
                      title={currentModel?.description ?? `사용 중인 AI 모델: ${currentModelLabel}`}
                      aria-label={`사용 중인 AI 모델: ${currentModelLabel}`}
                    >
                      <span
                        className="field-model-dot"
                        style={{ background: providerColor(currentModel?.provider ?? '') }}
                      />
                      {currentModelLabel}
                    </span>
                  )}
                  <button
                    className="btn btn-icon-bare"
                    style={{ position: 'absolute', right: 6, bottom: 6, height: 38, width: 38, padding: 0, display: MIC_DISABLED ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => { setShowKb(false); setDraft(''); }}
                    aria-label="음성으로 전환"
                    title="음성으로 전환"
                  >
                    <Icon.mic width={20} height={20} />
                  </button>
                </div>
                <button className="btn btn-primary" style={{ height: 50, padding: '0 18px', alignSelf: 'flex-end' }} disabled={typing || transcribing} onClick={() => void sendText(draft)}>
                  <Icon.arrow />
                </button>
              </div>
            )}
            {showKb && (
              <div className="dock-hint">
                {MIC_DISABLED
                  ? '오늘 있었던 일을 편하게 입력해 주세요'
                  : (voice.permissionDenied || speech.permissionDenied)
                  ? '마이크 권한이 없어요. 키보드로 입력해 주세요.'
                  : '직접 입력하거나, 음성으로 다시 돌아갈 수 있어요'}
              </div>
            )}
          </>
        )}
        {done && <div className="dock-hint">대화가 마무리됐어요 🌙</div>}
      </div>
      </div>

      {pendingModelId && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '0 24px' }}
          onClick={() => setPendingModelId(undefined)}
        >
          <div
            style={{ background: 'var(--surface)', borderRadius: 22, padding: '28px 22px 20px', width: '100%', maxWidth: 340, boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>대화를 일기로 저장할까요?</div>
            <div style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 22, lineHeight: 1.65 }}>
              모델을 전환하면 현재 대화가 종료돼요.<br />
              지금까지의 이야기를 일기로 남길 수 있어요.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                className="btn btn-primary btn-pill"
                style={{ height: 48 }}
                onClick={() => {
                  const target = pendingModelId;
                  setPendingModelId(undefined);
                  void doModelSwitch(target, true);
                }}
              >
                <Icon.spark width={16} height={16} /> 일기로 저장하고 전환
              </button>
              <button
                className="btn btn-ghost btn-pill"
                style={{ height: 44 }}
                onClick={() => {
                  const target = pendingModelId;
                  setPendingModelId(undefined);
                  void doModelSwitch(target, false);
                }}
              >
                저장 없이 전환
              </button>
              <button
                className="btn btn-ghost btn-pill"
                style={{ height: 40, color: 'var(--text-2)', fontSize: 13 }}
                onClick={() => setPendingModelId(undefined)}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {safetyOpen && (
        <SafetyOverlay
          stopped={stopped}
          onContinue={() => setSafetyOpen(false)}
          onEnd={() => { setSafetyOpen(false); setDone(true); }}
        />
      )}

      {writing && (
        <div className="writing-overlay">
          <WaveOrb size={200} active intensity={1.4} />
          <div style={{ marginTop: 14, fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>오늘을 일기로 옮기고 있어요</div>
          <div style={{ marginTop: 8, color: 'var(--text-2)', fontSize: 14.5 }}>당신의 말투를 닮은 한 편의 글로요…</div>
        </div>
      )}
    </div>
  );
}
