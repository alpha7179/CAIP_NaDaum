// 온보딩 (동의 → 지역 → 보호자 등록, 완료 시 /home)
import { NON_MEDICAL_DISCLAIMER_BODY } from '@nadaum/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { Dropdown } from '../components/Dropdown';
import { Icon } from '../components/Icon';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { WaveOrb } from '../components/WaveOrb';
import { REGIONS, PROVINCES } from '../data/regions';
import { PHONE_RE, formatPhone, toE164 } from '../utils/phone';
const TOTAL_STEPS = 3;

const GUARDIAN_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ConsentState {
  privacyPolicy: boolean;
  nonMedicalDisclaimer: boolean;
  guardianNotification: boolean;
}

const CONSENT_ITEMS: { key: keyof ConsentState; label: string; desc: string }[] = [
  { key: 'privacyPolicy',        label: '개인정보 수집·이용 동의',  desc: '대화·일기 기록을 안전하게 보관하기 위해 필요해요.' },
  { key: 'nonMedicalDisclaimer', label: '비의료 서비스 안내 확인',  desc: '진단·처방·치료를 제공하지 않는 정서 기록 도구예요.' },
  { key: 'guardianNotification', label: '보호자 알림 동의',          desc: '위급 상황 시 등록한 보호자에게 안내를 보낼 수 있어요. (대화 내용은 미포함)' },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const { name, completeOnboarding, api } = useAuth();
  const nm = name ?? '회원';
  const [step, setStep] = useState(0);
  const [consent, setConsent] = useState<ConsentState>({
    privacyPolicy: false,
    nonMedicalDisclaimer: false,
    guardianNotification: false,
  });

  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const districts = province ? (REGIONS[province] ?? []) : [];
  const regionValid = province !== '' && district !== '';

  const [guardians, setGuardians] = useState<
    { relationship: string; name: string; email: string; phone: string; emailEnabled: boolean; smsEnabled: boolean }[]
  >([]);

  const allConsented = consent.privacyPolicy && consent.nonMedicalDisclaimer && consent.guardianNotification;
  const allChecked = allConsented;

  function toggleAll() {
    const next = !allChecked;
    setConsent({ privacyPolicy: next, nonMedicalDisclaimer: next, guardianNotification: next });
  }

  function addGuardian() {
    if (guardians.length >= 5) return;
    setGuardians((g) => [...g, { relationship: '', name: '', email: '', phone: '', emailEnabled: true, smsEnabled: true }]);
  }
  function updateGuardian(i: number, field: 'relationship' | 'name' | 'email' | 'phone', value: string) {
    setGuardians((g) => g.map((v, idx) => (idx === i ? { ...v, [field]: value } : v)));
  }
  function toggleGuardianChannel(i: number, field: 'emailEnabled' | 'smsEnabled') {
    setGuardians((g) => g.map((v, idx) => (idx === i ? { ...v, [field]: !v[field] } : v)));
  }
  function removeGuardian(i: number) {
    setGuardians((g) => g.filter((_, idx) => idx !== i));
  }

  const guardiansValid = guardians.every((g) => {
    const empty = g.name.trim() === '' && g.email.trim() === '' && g.phone.trim() === '';
    if (empty) return true;
    return g.name.trim() !== '' && GUARDIAN_EMAIL_RE.test(g.email.trim()) && PHONE_RE.test(g.phone.trim());
  });

  async function finish() {
    const valid = guardians.filter(
      (g) => g.name.trim() !== '' && GUARDIAN_EMAIL_RE.test(g.email.trim()) && PHONE_RE.test(g.phone.trim()),
    );
    try {
      if (province && district) {
        localStorage.setItem('nadaum.region', JSON.stringify({ province, district }));
      }
      localStorage.setItem('nadaum.guardians', JSON.stringify(valid));
    } catch {}
    try {
      await api.setGuardians(
        valid.map((g) => ({
          ...(g.relationship.trim() ? { relationship: g.relationship.trim() } : {}),
          name: g.name.trim(),
          email: g.email.trim(),
          phone: toE164(g.phone),
          emailEnabled: g.emailEnabled,
          smsEnabled: g.smsEnabled,
        })),
      );
    } catch {}
    completeOnboarding();
    navigate('/home', { replace: true });
  }

  const STEP_META = [
    { title: `${nm}님, 환영해요`, desc: '안전한 대화를 위해 아래 항목에 동의해 주세요.' },
    { title: '어디에 살고 계세요?', desc: '가까운 상담 기관을 안내해 드리기 위해 필요해요.' },
    { title: '보호자를 등록할까요?', desc: '위급 상황 시 도움을 줄 수 있는 분이에요. 나중에 추가해도 괜찮아요.' },
  ];
  const meta = STEP_META[step]!;

  return (
    <div className="auth onboarding fade-in">
      <div className="atmos" />
      <div className="onboarding-wrap">
        <div className="onboarding-header">
          <div style={{ marginBottom: 14 }}><WaveOrb size={96} /></div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>시작 전 안내 · {step + 1}/{TOTAL_STEPS}</div>
          <h1>{meta.title}</h1>
          <p className="sub">{meta.desc}</p>
        </div>

        <div className="onboarding-body">

        {step === 0 && (
          <div className="onboarding-consent-split">
            <div className="onboarding-disclaimer">
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)', marginBottom: 12 }}>안내 사항</div>
              <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                {NON_MEDICAL_DISCLAIMER_BODY}
              </div>
            </div>

            <div className="onboarding-consent-panel">
              <button
                onClick={toggleAll}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                  padding: '14px 16px', borderRadius: 14, marginBottom: 10,
                  background: allChecked ? 'var(--accent-soft)' : 'var(--surface-2)',
                  border: `1.5px solid ${allChecked ? 'var(--accent)' : 'var(--border)'}`,
                  transition: 'all 0.15s', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  display: 'grid', placeItems: 'center',
                  background: allChecked ? 'var(--accent)' : 'var(--border)',
                  color: '#fff',
                }}>
                  <Icon.check width={13} height={13} />
                </span>
                <span style={{ fontSize: 15.5, fontWeight: 700 }}>전체 동의하기</span>
              </button>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {CONSENT_ITEMS.map((item) => {
                  const checked = consent[item.key];
                  return (
                    <button
                      key={item.key}
                      onClick={() => setConsent((c) => ({ ...c, [item.key]: !c[item.key] }))}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 11, width: '100%',
                        padding: '12px 14px', borderRadius: 12, background: 'none', border: 'none',
                        cursor: 'pointer', textAlign: 'left', transition: 'background 0.12s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    >
                      <span style={{
                        width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                        display: 'grid', placeItems: 'center',
                        background: checked ? 'var(--accent)' : 'transparent',
                        border: checked ? 'none' : '1.5px solid var(--border-strong)',
                        color: '#fff',
                      }}>
                        {checked && <Icon.check width={12} height={12} />}
                      </span>
                      <span>
                        <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text)' }}>
                          {item.label} <span style={{ color: 'var(--accent)', fontSize: 12.5 }}>(필수)</span>
                        </span>
                        <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-3)', marginTop: 3, lineHeight: 1.4 }}>
                          {item.desc}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                className="btn btn-primary btn-block"
                disabled={!allConsented}
                onClick={() => setStep(1)}
                style={{ marginTop: 20 }}
              >
                <span>동의하고 계속하기</span><Icon.arrow />
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="onboarding-narrow">
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Dropdown label="광역시 / 도" value={province} options={PROVINCES} onChange={(v) => { setProvince(v); setDistrict(''); }} />
              <Dropdown
                label="시 / 군 / 구"
                value={district}
                options={districts}
                disabled={province === ''}
                onChange={setDistrict}
              />
            </div>

            <button
              className="btn btn-primary btn-block"
              disabled={!regionValid}
              onClick={() => setStep(2)}
              style={{ marginTop: 24 }}
            >
              <span>다음</span><Icon.arrow />
            </button>
            <div className="auth-foot">
              <a onClick={() => setStep(0)}>이전으로</a>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-narrow">
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {guardians.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 14, padding: '20px 0' }}>
                  등록된 보호자가 없어요.
                </div>
              )}

              {guardians.map((g, i) => {
                const phoneInvalid = g.phone.trim() !== '' && !PHONE_RE.test(g.phone.trim());
                const emailInvalid = g.email.trim() !== '' && !GUARDIAN_EMAIL_RE.test(g.email.trim());
                const emailUsable = GUARDIAN_EMAIL_RE.test(g.email.trim());
                const smsUsable = PHONE_RE.test(g.phone.trim());
                return (
                  <div key={i} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 14, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>보호자 {i + 1}</span>
                      <button
                        onClick={() => removeGuardian(i)}
                        aria-label="삭제"
                        style={{
                          width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                          background: 'var(--surface-3)', color: 'var(--text-3)',
                          display: 'grid', placeItems: 'center', cursor: 'pointer', border: 'none',
                        }}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                    <div className="guardian-fields">
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          className="input"
                          type="text"
                          placeholder="관계 (선택)"
                          value={g.relationship}
                          onChange={(e) => updateGuardian(i, 'relationship', e.target.value)}
                          style={{ flex: '0 0 38%', minWidth: 0, background: 'var(--surface)' }}
                        />
                        <input
                          className="input"
                          type="text"
                          placeholder="이름"
                          value={g.name}
                          onChange={(e) => updateGuardian(i, 'name', e.target.value)}
                          style={{ flex: 1, minWidth: 0, background: 'var(--surface)' }}
                        />
                      </div>
                      <input
                        className="input"
                        type="email"
                        placeholder="이메일"
                        value={g.email}
                        onChange={(e) => updateGuardian(i, 'email', e.target.value)}
                        style={{ background: 'var(--surface)', ...(emailInvalid ? { borderColor: '#e04040' } : {}) }}
                      />
                      <input
                        className="input"
                        type="tel"
                        placeholder="전화번호"
                        inputMode="numeric"
                        value={g.phone}
                        onChange={(e) => updateGuardian(i, 'phone', formatPhone(e.target.value))}
                        style={{ background: 'var(--surface)', ...(phoneInvalid ? { borderColor: '#e04040' } : {}) }}
                      />
                    </div>
                    <div className="guardian-channels">
                      <span className={`guardian-channel${emailUsable ? '' : ' is-disabled'}`}>
                        <ToggleSwitch
                          size="sm"
                          on={emailUsable && g.emailEnabled}
                          disabled={!emailUsable}
                          onChange={() => toggleGuardianChannel(i, 'emailEnabled')}
                          ariaLabel="이메일 알림"
                        />
                        <span>이메일 알림</span>
                      </span>
                      <span className={`guardian-channel${smsUsable ? '' : ' is-disabled'}`}>
                        <ToggleSwitch
                          size="sm"
                          on={smsUsable && g.smsEnabled}
                          disabled={!smsUsable}
                          onChange={() => toggleGuardianChannel(i, 'smsEnabled')}
                          ariaLabel="문자(SMS) 알림"
                        />
                        <span>문자(SMS) 알림</span>
                      </span>
                    </div>
                  </div>
                );
              })}

              {guardians.length < 5 && (
                <button
                  onClick={addGuardian}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    height: 50, borderRadius: 14, width: '100%',
                    background: 'var(--surface-2)', border: '1.5px dashed var(--border-strong)',
                    color: 'var(--text-2)', fontSize: 14.5, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <Icon.plus width={18} height={18} /> 보호자 추가
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                className="btn btn-primary"
                disabled={!guardiansValid}
                onClick={finish}
                style={{ flex: 3 }}
              >
                <span>시작하기</span><Icon.arrow />
              </button>
              <button
                className="btn"
                onClick={finish}
                style={{ flex: 1, background: 'var(--border)', color: 'var(--text-2)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--border-strong)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--border)')}
              >
                건너뛰기
              </button>
            </div>
            <div className="auth-foot">
              <a onClick={() => setStep(1)}>이전으로</a>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
