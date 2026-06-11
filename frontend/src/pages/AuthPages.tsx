// 로그인 / 회원가입 페이지 (백엔드 연결)
import { useState } from 'react';

import { ApiError } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { WaveOrb } from '../components/WaveOrb';


type GoFn = (r: string) => void;

function AuthShell({ children, onBack }: { children: React.ReactNode; onBack?: () => void }) {
  return (
    <div className="auth fade-in">
      <div className="atmos" />
      {onBack && (
        <button className="auth-back-btn" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          돌아가기
        </button>
      )}
      <div className="auth-card" style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
}

export function LoginPage({ go }: { go: GoFn }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [pw, setPw]       = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy]   = useState(false);
  const ok = email.length > 0 && pw.length >= 4;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ok) return;
    setBusy(true);
    setError('');
    try {
      await login(email, pw);
      go('home');
    } catch {
      setError('아이디 또는 비밀번호를 확인해주세요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell onBack={() => go('landing')}>
      <div style={{ marginBottom: 8 }}><WaveOrb size={132} /></div>
      <div className="eyebrow" style={{ marginBottom: 12, fontFamily: 'var(--font-logo)' }}>나, 다움</div>
      <h1>다시 만나서 반가워요</h1>
      <p className="sub">대화를 시작하면, 오늘이 일기가 됩니다.</p>

      <form className="auth-form" onSubmit={onSubmit} style={{ marginTop: 28 }}>
        <div className="login-field-box">
          <div className={`login-field-row${email ? ' has-value' : ''}`}>
            <label className="login-float-label">아이디</label>
            <input
              className="login-float-input"
              type="text"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {email && (
              <button type="button" className="login-clear-btn" onClick={() => setEmail('')} tabIndex={-1} aria-label="지우기">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" fill="#b0b8c1"/>
                  <path d="M8 8l8 8M16 8l-8 8" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>

          <div className="login-field-divider" />

          <div className={`login-field-row${pw ? ' has-value' : ''}`}>
            <label className="login-float-label">비밀번호</label>
            <input
              className="login-float-input"
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {pw && (
                <button type="button" className="login-clear-btn" onClick={() => setShowPw((v) => !v)} tabIndex={-1} aria-label={showPw ? '숨기기' : '보기'}>
                  {showPw ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="#8b95a1" strokeWidth="2"/>
                      <circle cx="12" cy="12" r="3" stroke="#8b95a1" strokeWidth="2"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" stroke="#8b95a1" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  )}
                </button>
              )}
              {pw && (
                <button type="button" className="login-clear-btn" onClick={() => setPw('')} tabIndex={-1} aria-label="지우기">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" fill="#b0b8c1"/>
                    <path d="M8 8l8 8M16 8l-8 8" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {error && <div style={{ color: '#e04040', fontSize: 13.5, textAlign: 'center', marginTop: 8 }}>{error}</div>}
        <button className="btn btn-primary btn-block" type="submit" disabled={!ok || busy} style={{ marginTop: 14 }}>
          {busy ? '로그인 중…' : <><span>로그인</span><Icon.arrow /></>}
        </button>
      </form>

      <div className="divider-or" style={{ width: '100%', marginTop: 24 }}>또는</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
        <button className="social-btn" onClick={() => { window.location.href = `${(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''}/auth/google`; }}>
          <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Google로 로그인
        </button>
      </div>

      <div className="auth-foot">처음이신가요? <a onClick={() => go('signup')}>회원가입</a></div>
    </AuthShell>
  );
}

export function SignupPage({ go }: { go: GoFn }) {
  const { register, setName: saveNameCtx, api } = useAuth();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const steps = [
    { valid: name.trim().length >= 1 },
    { valid: email.includes('@') },
    { valid: pw.length >= 6 && pw2 === pw },
  ];
  const last = step === steps.length - 1;

  async function next() {
    if (!steps[step]?.valid || busy) return;
    setError('');

    if (step === 1) {
      setBusy(true);
      try {
        const { available } = await api.checkEmail(email);
        if (!available) {
          setError('이미 가입된 이메일이에요. 다른 이메일을 사용해 주세요.');
          return;
        }
        setStep(2);
      } catch {
        setError('이메일 확인 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.');
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!last) { setStep(step + 1); return; }
    setBusy(true);
    setError('');
    try {
      await register({
        email,
        password: pw,
        name: name.trim(),
        consentItems: { privacyPolicy: true, nonMedicalDisclaimer: true, guardianNotification: true },
      }, name.trim());
      saveNameCtx(name.trim());
      go('home');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'email_taken') {
        setError('이미 가입된 이메일이에요. 다른 이메일을 사용해 주세요.');
        setStep(1);
      } else {
        setError('회원가입에 실패했어요. 다시 시도해 주세요.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell onBack={() => go('landing')}>
      <div style={{ marginBottom: 22 }}><WaveOrb size={118} /></div>
      <div className="eyebrow" style={{ marginBottom: 12 }}>회원가입 · {step + 1}/3</div>

      {step === 0 && (
        <>
          <h1>어떻게 불러드릴까요?</h1>
          <p className="sub">일기 속에서 당신을 부를 이름이에요.</p>
          <form className="auth-form" onSubmit={(e) => { e.preventDefault(); next(); }}>
            <div className="field">
              <label>이름</label>
              <input className="input" autoFocus placeholder="다움"
                value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </form>
        </>
      )}

      {step === 1 && (
        <>
          <h1>이메일을 알려주세요</h1>
          <p className="sub">소중한 기록을 안전하게 보관할게요.</p>
          <form className="auth-form" onSubmit={(e) => { e.preventDefault(); next(); }}>
            <div className="field">
              <label>이메일</label>
              <input className="input" autoFocus type="email" placeholder="example@nadaum.ai"
                value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} />
            </div>
          </form>
        </>
      )}

      {step === 2 && (
        <>
          <h1>비밀번호를 만들어 주세요</h1>
          <p className="sub">6자 이상이면 충분해요.</p>
          <form className="auth-form" onSubmit={(e) => { e.preventDefault(); next(); }}>
            <div className="field">
              <label>비밀번호 (6자 이상)</label>
              <input className="input" autoFocus type="password" placeholder="••••••••"
                value={pw} onChange={(e) => setPw(e.target.value)} />
            </div>
            <div className="field">
              <label>비밀번호 확인</label>
              <input className="input" type="password" placeholder="••••••••"
                value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </div>
            {pw2.length > 0 && pw2 !== pw && (
              <div style={{ color: '#e04040', fontSize: 13, marginTop: 4 }}>비밀번호가 일치하지 않아요.</div>
            )}
          </form>
        </>
      )}

      {error && <div style={{ color: '#e04040', fontSize: 13.5, textAlign: 'center', marginTop: 8 }}>{error}</div>}

      <button className="btn btn-primary btn-block" disabled={!steps[step]?.valid || busy} onClick={next} style={{ marginTop: 22 }}>
        {busy ? '처리 중…' : last ? <><span>시작하기</span><Icon.arrow /></> : <><span>다음</span><Icon.arrow /></>}
      </button>

      <div className="auth-foot">
        {step === 0
          ? <>이미 계정이 있으신가요? <a onClick={() => go('login')}>로그인</a></>
          : <a onClick={() => setStep(step - 1)}>이전으로</a>}
      </div>
    </AuthShell>
  );
}
