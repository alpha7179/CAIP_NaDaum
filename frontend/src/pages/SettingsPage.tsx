// 설정 (계정 / 이용 환경 / 보호자·안전 알림 / 외부 연동 / 계정 관리)
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { NotificationPreferences, NotionStatus } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Avatar } from '../components/Avatar';
import { BackButton } from '../components/BackButton';
import { Dropdown } from '../components/Dropdown';
import { Icon } from '../components/Icon';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { REGIONS, PROVINCES } from '../data/regions';
import { PHONE_RE, formatPhone, toE164, fromE164 } from '../utils/phone';

interface Guardian { relationship: string; name: string; email: string; phone: string; emailEnabled: boolean; smsEnabled: boolean }

const GUARDIAN_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readRegion(): { province: string; district: string } {
  try {
    const raw = localStorage.getItem('nadaum.region');
    if (raw) return JSON.parse(raw);
  } catch { /* noop */ }
  return { province: '', district: '' };
}
function readGuardians(): Guardian[] {
  try {
    const raw = localStorage.getItem('nadaum.guardians');
    if (raw) {
      const parsed = JSON.parse(raw) as Array<Partial<Guardian>>;
      return parsed.map((g) => ({
        relationship: g.relationship ?? '',
        name: g.name ?? '',
        email: g.email ?? '',
        phone: g.phone ?? '',
        emailEnabled: g.emailEnabled ?? true,
        smsEnabled: g.smsEnabled ?? true,
      }));
    }
  } catch { /* noop */ }
  return [];
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 24, marginBottom: 18 }}>
      <h3 style={{ fontSize: 16.5, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 18 }}>{title}</h3>
      {children}
    </div>
  );
}

function Category({ title }: { title: string }) {
  return (
    <div className="settings-category">
      <div className="settings-category-title">{title}</div>
    </div>
  );
}

function Toggle({ on, onClick, label, desc }: { on: boolean; onClick: () => void; label: string; desc: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, width: '100%',
        padding: '14px 16px', borderRadius: 14, background: 'var(--surface-2)',
        border: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left',
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>{label}</span>
        <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-3)', marginTop: 3, lineHeight: 1.4 }}>{desc}</span>
      </span>
      <ToggleSwitch on={on} onChange={onClick} ariaLabel={label} />
    </button>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { provider, userId, name, email, photo, isAdmin, api, logout } = useAuth();
  const isLocal = provider === 'local';

  function handleLogout() {
    logout();
    navigate('/');
  }

  const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm'>('idle');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState('');

  async function handleDeleteAccount() {
    setDeleteBusy(true);
    setDeleteErr('');
    try {
      await api.deleteAccount();
      if (userId) {
        localStorage.removeItem(`nadaum.name.${userId}`);
        localStorage.removeItem(`nadaum.onboarded.${userId}`);
      }
      localStorage.removeItem('nadaum.region');
      localStorage.removeItem('nadaum.guardians');
      logout();
      navigate('/');
    } catch (e) {
      setDeleteErr(e instanceof Error ? e.message : '탈퇴 처리 중 오류가 발생했어요.');
      setDeleteBusy(false);
    }
  }

  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | undefined>();
  const [pwBusy, setPwBusy] = useState(false);
  const pwValid = curPw.length >= 4 && newPw.length >= 6 && newPw === newPw2;

  async function submitPassword() {
    if (!pwValid) return;
    setPwBusy(true);
    setPwMsg(undefined);
    try {
      await api.changePassword(curPw, newPw);
      setPwMsg({ type: 'ok', text: '비밀번호가 변경되었어요.' });
      setCurPw(''); setNewPw(''); setNewPw2('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '변경에 실패했어요.';
      setPwMsg({ type: 'err', text: msg });
    } finally {
      setPwBusy(false);
    }
  }

  const initRegion = readRegion();
  const [province, setProvince] = useState(initRegion.province);
  const [district, setDistrict] = useState(initRegion.district);
  const [regionMsg, setRegionMsg] = useState(false);
  const districts = province ? (REGIONS[province] ?? []) : [];

  function saveRegion() {
    if (!province || !district) return;
    localStorage.setItem('nadaum.region', JSON.stringify({ province, district }));
    setRegionMsg(true);
    setTimeout(() => setRegionMsg(false), 2000);
  }

  const [guardians, setGuardians] = useState<Guardian[]>(readGuardians);
  const [gMsg, setGMsg] = useState(false);
  const [gErr, setGErr] = useState('');
  const [gBusy, setGBusy] = useState(false);
  const guardiansValid = guardians.every(
    (g) => g.name.trim() !== '' && GUARDIAN_EMAIL_RE.test(g.email.trim()) && PHONE_RE.test(g.phone.trim()),
  );

  useEffect(() => {
    let alive = true;
    api.getGuardians()
      .then((res) => {
        if (!alive) return;
        const list = res.guardians.map((g) => ({
          relationship: g.relationship ?? '',
          name: g.name,
          email: g.email,
          phone: fromE164(g.phone),
          emailEnabled: g.emailEnabled,
          smsEnabled: g.smsEnabled,
        }));
        setGuardians(list);
        try { localStorage.setItem('nadaum.guardians', JSON.stringify(list)); } catch { /* noop */ }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [api]);

  function addGuardian() {
    if (guardians.length >= 5) return;
    setGuardians((g) => [...g, { relationship: '', name: '', email: '', phone: '', emailEnabled: true, smsEnabled: true }]);
  }
  function updateGuardian(i: number, field: keyof Guardian, value: string) {
    setGuardians((g) => g.map((v, idx) => (idx === i ? { ...v, [field]: value } : v)));
  }
  function toggleGuardianChannel(i: number, field: 'emailEnabled' | 'smsEnabled') {
    setGuardians((g) => g.map((v, idx) => (idx === i ? { ...v, [field]: !v[field] } : v)));
  }
  function removeGuardian(i: number) {
    setGuardians((g) => g.filter((_, idx) => idx !== i));
  }
  async function saveGuardians() {
    if (!guardiansValid || gBusy) return;
    setGBusy(true);
    setGErr('');
    try {
      const dto = guardians.map((g) => ({
        ...(g.relationship.trim() ? { relationship: g.relationship.trim() } : {}),
        name: g.name.trim(),
        email: g.email.trim(),
        phone: toE164(g.phone),
        emailEnabled: g.emailEnabled,
        smsEnabled: g.smsEnabled,
      }));
      await api.setGuardians(dto);
      localStorage.setItem('nadaum.guardians', JSON.stringify(guardians));
      setGMsg(true);
      setTimeout(() => setGMsg(false), 2000);
    } catch (e) {
      setGErr(e instanceof Error ? e.message : '보호자 저장에 실패했어요.');
    } finally {
      setGBusy(false);
    }
  }

  const [prefs, setPrefs] = useState<NotificationPreferences | undefined>();
  const [prefsErr, setPrefsErr] = useState('');
  useEffect(() => {
    let alive = true;
    api.getNotificationPreferences()
      .then((p) => { if (alive) setPrefs(p); })
      .catch(() => {
        if (!alive) return;
        setPrefs({ emailEnabled: true, smsEnabled: true });
        setPrefsErr('알림 설정을 불러오지 못했어요. (저장 시 다시 시도됩니다)');
      });
    return () => { alive = false; };
  }, [api]);

  async function togglePref(key: keyof NotificationPreferences) {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setPrefsErr('');
    try {
      const saved = await api.setNotificationPreferences({ [key]: next[key] });
      setPrefs(saved);
    } catch {
      setPrefs(prefs);
      setPrefsErr('알림 설정 저장에 실패했어요.');
    }
  }

  const [notionStatus, setNotionStatus] = useState<NotionStatus | null>(null);
  const [notionLoading, setNotionLoading] = useState(true);
  const [notionBusy, setNotionBusy] = useState(false);
  const [notionErr, setNotionErr] = useState('');
  const [notionMsg, setNotionMsg] = useState(false);
  const [notionToken, setNotionToken] = useState('');
  const [notionPage, setNotionPage] = useState('');
  const [notionEdit, setNotionEdit] = useState(false);
  const [notionEditPage, setNotionEditPage] = useState('');

  useEffect(() => {
    let alive = true;
    api.getNotionStatus()
      .then((s) => { if (alive) setNotionStatus(s); })
      .catch(() => { if (alive) setNotionStatus({ connected: false }); })
      .finally(() => { if (alive) setNotionLoading(false); });
    return () => { alive = false; };
  }, [api]);

  async function connectNotion() {
    if (notionBusy) return;
    const token = notionToken.trim();
    if (token.length === 0) { setNotionErr('노션 통합 토큰을 입력해 주세요.'); return; }
    setNotionBusy(true);
    setNotionErr('');
    try {
      const s = await api.connectNotion(token, notionPage.trim() || undefined);
      setNotionStatus(s);
      setNotionToken('');
      setNotionPage('');
      if (s.hasTarget === false) {
        setNotionErr('연결됐지만 저장할 페이지가 없어요. 노션에서 통합에 페이지를 공유한 뒤 다시 연결해 주세요.');
      } else {
        setNotionMsg(true);
        setTimeout(() => setNotionMsg(false), 2000);
      }
    } catch (e) {
      const code = (e as { code?: string })?.code;
      const detail = (e as { message?: string })?.message;
      if (code === 'invalid_token') setNotionErr('토큰이 올바르지 않아요. 다시 확인해 주세요.');
      else if (code === 'invalid_page_url' || code === 'notion_page_not_accessible') setNotionErr(detail ?? '페이지 링크를 확인해 주세요.');
      else setNotionErr(detail ? `노션 연결 실패: ${detail}` : '노션 연결에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setNotionBusy(false);
    }
  }

  async function disconnectNotion() {
    if (notionBusy) return;
    setNotionBusy(true);
    setNotionErr('');
    try {
      await api.disconnectNotion();
      setNotionStatus({ connected: false });
      setNotionEdit(false);
    } catch {
      setNotionErr('연결 해제에 실패했어요.');
    } finally {
      setNotionBusy(false);
    }
  }

  async function updateNotionTarget() {
    if (notionBusy) return;
    setNotionBusy(true);
    setNotionErr('');
    try {
      const s = await api.updateNotionTarget(notionEditPage.trim() || undefined);
      setNotionStatus(s);
      setNotionEdit(false);
      setNotionEditPage('');
      if (s.hasTarget === false) {
        setNotionErr('저장할 페이지가 없어요. 노션에서 통합에 페이지를 공유한 뒤 다시 시도해 주세요.');
      } else {
        setNotionMsg(true);
        setTimeout(() => setNotionMsg(false), 2000);
      }
    } catch (e) {
      const code = (e as { code?: string })?.code;
      const detail = (e as { message?: string })?.message;
      if (code === 'invalid_page_url' || code === 'notion_page_not_accessible') setNotionErr(detail ?? '페이지 링크를 확인해 주세요.');
      else if (code === 'notion_reauth_required') { setNotionStatus({ connected: false }); setNotionErr('노션 연결이 만료됐어요. 다시 연결해 주세요.'); }
      else setNotionErr(detail ? `저장 페이지 변경 실패: ${detail}` : '저장 페이지 변경에 실패했어요.');
    } finally {
      setNotionBusy(false);
    }
  }

  return (
    <div className="page fade">
      <div className="page-back-row">
        <BackButton onClick={() => navigate('/home')} />
      </div>
      <div className="page-head">
        <div className="eyebrow">설정</div>
        <h1 className="page-title" style={{ marginTop: 8 }}>내 정보 관리</h1>
      </div>

      <Category title="계정" />

      <Section title="내 프로필">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar name={name} email={email} photo={provider === 'google' ? photo : undefined} size={48} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>
                {name && name.length > 0 ? name : '이름 없음'}
              </span>
              {isAdmin && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#e89320', background: 'rgba(232,147,32,0.12)', borderRadius: 6, padding: '2px 8px' }}>
                  관리자
                </span>
              )}
            </div>
            {provider !== 'google' && (
              <div style={{ fontSize: 13.5, color: 'var(--text-3)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                아이디 : {email && email.length > 0 ? email : '—'}
              </div>
            )}
          </div>
        </div>
      </Section>

      <Section title="비밀번호 변경">
        {isLocal ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="field">
              <label>현재 비밀번호</label>
              <input className="input" type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} placeholder="현재 비밀번호" />
            </div>
            <div className="field">
              <label>새 비밀번호 (6자 이상)</label>
              <input className="input" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="새 비밀번호" />
            </div>
            <div className="field">
              <label>새 비밀번호 확인</label>
              <input className="input" type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} placeholder="다시 입력" />
            </div>
            {newPw2.length > 0 && newPw !== newPw2 && (
              <div style={{ color: '#e04040', fontSize: 13 }}>비밀번호가 일치하지 않아요.</div>
            )}
            {pwMsg && (
              <div style={{ color: pwMsg.type === 'ok' ? 'var(--accent)' : '#e04040', fontSize: 13.5, fontWeight: 600 }}>{pwMsg.text}</div>
            )}
            <button className="btn btn-primary" disabled={!pwValid || pwBusy} onClick={submitPassword} style={{ marginTop: 4, alignSelf: 'flex-start' }}>
              {pwBusy ? '변경 중…' : '비밀번호 변경'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-3)', fontSize: 14 }}>
            <Icon.shield width={18} height={18} />
            Google 계정으로 로그인하셨어요. 비밀번호는 Google에서 관리됩니다.
          </div>
        )}
      </Section>

      <Category title="이용 환경" />

      <Section title="지역 설정">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Dropdown label="광역시 / 도" value={province} options={PROVINCES} onChange={(v) => { setProvince(v); setDistrict(''); }} />
          <Dropdown
            label="시 / 군 / 구"
            value={district}
            options={districts}
            disabled={!province}
            onChange={setDistrict}
          />
          {regionMsg && <div style={{ color: 'var(--accent)', fontSize: 13.5, fontWeight: 600 }}>지역이 저장되었어요.</div>}
          <button className="btn btn-primary" disabled={!province || !district} onClick={saveRegion} style={{ marginTop: 4, alignSelf: 'flex-start' }}>
            지역 저장
          </button>
        </div>
      </Section>

      <Category title="보호자 · 안전 알림" />

      <Section title="보호자 관리">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {guardians.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 14, padding: '12px 0' }}>등록된 보호자가 없어요.</div>
          )}
          {guardians.map((g, i) => {
            const phoneInvalid = g.phone.trim() !== '' && !PHONE_RE.test(g.phone.trim());
            const emailInvalid = g.email.trim() !== '' && !GUARDIAN_EMAIL_RE.test(g.email.trim());
            const emailUsable = GUARDIAN_EMAIL_RE.test(g.email.trim());
            const smsUsable = PHONE_RE.test(g.phone.trim());
            const emailMasterOn = prefs?.emailEnabled ?? true;
            const smsMasterOn = prefs?.smsEnabled ?? true;
            const emailEditable = emailUsable && emailMasterOn;
            const smsEditable = smsUsable && smsMasterOn;
            return (
              <div key={i} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 14, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>보호자 {i + 1}</span>
                  <button onClick={() => removeGuardian(i)} aria-label="삭제" style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--surface-3)', color: 'var(--text-3)', display: 'grid', placeItems: 'center', cursor: 'pointer', border: 'none' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                  </button>
                </div>
                <div className="guardian-fields">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="input" type="text" placeholder="관계 (선택)" value={g.relationship} onChange={(e) => updateGuardian(i, 'relationship', e.target.value)} style={{ flex: '0 0 38%', minWidth: 0, background: 'var(--surface)' }} />
                    <input className="input" type="text" placeholder="이름" value={g.name} onChange={(e) => updateGuardian(i, 'name', e.target.value)} style={{ flex: 1, minWidth: 0, background: 'var(--surface)' }} />
                  </div>
                  <input className="input" type="email" placeholder="이메일" value={g.email} onChange={(e) => updateGuardian(i, 'email', e.target.value)} style={{ background: 'var(--surface)', ...(emailInvalid ? { borderColor: '#e04040' } : {}) }} />
                  <input className="input" type="tel" inputMode="numeric" placeholder="전화번호" value={g.phone} onChange={(e) => updateGuardian(i, 'phone', formatPhone(e.target.value))} style={{ background: 'var(--surface)', ...(phoneInvalid ? { borderColor: '#e04040' } : {}) }} />
                </div>
                <div className="guardian-channels">
                  <span className={`guardian-channel${emailEditable ? '' : ' is-disabled'}`}>
                    <ToggleSwitch size="sm" on={emailUsable && g.emailEnabled} disabled={!emailEditable} onChange={() => toggleGuardianChannel(i, 'emailEnabled')} ariaLabel="이메일 알림" />
                    <span>이메일 알림</span>
                  </span>
                  <span className={`guardian-channel${smsEditable ? '' : ' is-disabled'}`}>
                    <ToggleSwitch size="sm" on={smsUsable && g.smsEnabled} disabled={!smsEditable} onChange={() => toggleGuardianChannel(i, 'smsEnabled')} ariaLabel="문자(SMS) 알림" />
                    <span>문자(SMS) 알림</span>
                  </span>
                </div>
              </div>
            );
          })}
          {guardians.length < 5 && (
            <button onClick={addGuardian} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: 50, borderRadius: 14, width: '100%', background: 'var(--surface-2)', border: '1.5px dashed var(--border-strong)', color: 'var(--text-2)', fontSize: 14.5, fontWeight: 600, cursor: 'pointer' }}>
              <Icon.plus width={18} height={18} /> 보호자 추가
            </button>
          )}
          {gMsg && <div style={{ color: 'var(--accent)', fontSize: 13.5, fontWeight: 600 }}>보호자 정보가 저장되었어요.</div>}
          {gErr && <div style={{ color: '#e04040', fontSize: 13.5, fontWeight: 600 }}>{gErr}</div>}
          <button className="btn btn-primary" disabled={!guardiansValid || gBusy} onClick={saveGuardians} style={{ marginTop: 4, alignSelf: 'flex-start' }}>
            {gBusy ? '저장 중…' : '보호자 저장'}
          </button>
        </div>
      </Section>

      <Section title="보호자 안전 알림">
        <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.65, marginBottom: 16 }}>
          위급(고위험) 상황으로 대화가 종료되면, 등록된 보호자에게 안내가 발송돼요.
          대화 내용은 포함되지 않아요. 알림을 원치 않으시면 아래 두 채널을 모두 꺼 주세요
          (둘 다 끄면 발송되지 않습니다).
        </p>
        {prefsErr && <div style={{ color: '#e04040', fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>{prefsErr}</div>}
        {prefs === undefined ? (
          <div style={{ color: 'var(--text-3)', fontSize: 14 }}>불러오는 중…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Toggle
              on={prefs.emailEnabled}
              onClick={() => togglePref('emailEnabled')}
              label="이메일 알림"
              desc="보호자 이메일로 안전 안내를 보냅니다."
            />
            <Toggle
              on={prefs.smsEnabled}
              onClick={() => togglePref('smsEnabled')}
              label="문자(SMS) 알림"
              desc="보호자 전화번호로 안전 안내 문자를 보냅니다."
            />
          </div>
        )}
      </Section>

      <Category title="외부 연동" />

      <Section title="노션 연동">
        <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.65, marginBottom: 16 }}>
          노션 통합 토큰과 저장할 페이지를 미리 연결해 두면, 일기 공유에서 바로 노션 페이지로 추가할 수 있어요.
        </p>
        {notionErr && <div style={{ color: '#e04040', fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>{notionErr}</div>}
        {notionMsg && <div style={{ color: 'var(--accent)', fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>노션이 연결되었어요.</div>}
        {notionLoading ? (
          <div style={{ color: 'var(--text-3)', fontSize: 14 }}>불러오는 중…</div>
        ) : notionStatus?.connected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>
              {notionStatus.workspaceName ? <><b>{notionStatus.workspaceName}</b> 워크스페이스</> : '워크스페이스'}
              {notionStatus.targetPageTitle ? <> · <b>{notionStatus.targetPageTitle}</b> 하위에 저장돼요.</> : ' · 저장 페이지가 지정되지 않았어요.'}
            </div>
            {notionEdit ? (
              <>
                <div className="field">
                  <label>새 저장 페이지 링크 (비우면 자동 선택)</label>
                  <input className="input" type="text" value={notionEditPage} onChange={(e) => setNotionEditPage(e.target.value)} placeholder="https://www.notion.so/… 페이지 링크" autoComplete="off" />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5, marginTop: -4 }}>
                  새 페이지도 먼저 <b>···  → 연결</b>에서 통합을 추가해 둬야 접근할 수 있어요. (토큰은 그대로 유지돼요)
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost" disabled={notionBusy} onClick={() => { setNotionEdit(false); setNotionEditPage(''); setNotionErr(''); }}>취소</button>
                  <button className="btn btn-primary" disabled={notionBusy} onClick={updateNotionTarget}>{notionBusy ? '변경 중…' : '저장 위치 변경'}</button>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" disabled={notionBusy} onClick={() => { setNotionEdit(true); setNotionEditPage(''); setNotionErr(''); }} style={{ alignSelf: 'flex-start' }}>
                  저장 페이지 수정
                </button>
                <button className="btn btn-ghost" disabled={notionBusy} onClick={disconnectNotion} style={{ alignSelf: 'flex-start' }}>
                  {notionBusy ? '처리 중…' : '연결 해제'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--text-3)', lineHeight: 1.7 }}>
              <li><a href="https://www.notion.so/my-integrations" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>notion.so/my-integrations</a>에서 통합을 만들고 <b>액세스 토큰</b>을 복사해요.</li>
              <li>저장할 페이지의 <b>···</b> 메뉴 → 맨 아래 <b>연결</b>에서 그 통합을 추가하고, <b>링크 복사</b>로 페이지 링크를 복사해요.</li>
            </ol>
            <div className="field">
              <label>통합 토큰</label>
              <input className="input" type="password" value={notionToken} onChange={(e) => setNotionToken(e.target.value)} placeholder="ntn_… 통합 토큰 붙여넣기" autoComplete="off" />
            </div>
            <div className="field">
              <label>저장할 페이지 링크 (선택)</label>
              <input className="input" type="text" value={notionPage} onChange={(e) => setNotionPage(e.target.value)} placeholder="https://www.notion.so/… 비우면 자동 선택" autoComplete="off" />
            </div>
            <button className="btn btn-primary" disabled={notionBusy || notionToken.trim().length === 0} onClick={connectNotion} style={{ marginTop: 4, alignSelf: 'flex-start' }}>
              {notionBusy ? '연결 중…' : '노션 연결'}
            </button>
          </div>
        )}
      </Section>

      <Category title="계정 관리" />

      <Section title="계정 삭제">        {deleteStep === 'idle' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65 }}>
              탈퇴하면 모든 대화 기록과 일기가 <b>영구 삭제</b>되며 복구할 수 없어요.
            </p>
            <button
              onClick={() => setDeleteStep('confirm')}
              style={{ alignSelf: 'flex-start', height: 40, padding: '0 18px', borderRadius: 10, fontSize: 14, fontWeight: 600, color: '#e04040', background: 'rgba(224,64,64,0.08)', border: '1px solid rgba(224,64,64,0.2)', cursor: 'pointer' }}
            >
              회원 탈퇴
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(224,64,64,0.07)', border: '1px solid rgba(224,64,64,0.18)' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#e04040', marginBottom: 6 }}>정말 탈퇴하시겠어요?</p>
              <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
                모든 일기·대화 기록·계정 정보가 즉시 삭제되며 되돌릴 수 없습니다.
              </p>
            </div>
            {deleteErr && <p style={{ fontSize: 13, color: '#e04040', fontWeight: 600 }}>{deleteErr}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setDeleteStep('idle'); setDeleteErr(''); }}
                disabled={deleteBusy}
                style={{ flex: 1, height: 44, borderRadius: 12, fontSize: 14.5, fontWeight: 600, background: 'var(--surface-3)', color: 'var(--text-2)', border: 'none', cursor: 'pointer' }}
              >
                취소
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteBusy}
                style={{ flex: 1, height: 44, borderRadius: 12, fontSize: 14.5, fontWeight: 700, background: '#e04040', color: '#fff', border: 'none', cursor: deleteBusy ? 'not-allowed' : 'pointer', opacity: deleteBusy ? 0.7 : 1 }}
              >
                {deleteBusy ? '삭제 중…' : '영구 삭제'}
              </button>
            </div>
          </div>
        )}
      </Section>

      <button
        className="settings-logout"
        onClick={handleLogout}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        로그아웃
      </button>
    </div>
  );
}
