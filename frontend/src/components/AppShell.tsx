// 앱 셸 네비게이션 컴포넌트 (사이드바·탭바·모바일 상단·상단바·레일·맨위로)
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '../auth/AuthContext';

import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { LogoImg } from './LogoImg';

type Route = 'landing' | 'login' | 'signup' | 'home' | 'chat' | 'diary' | 'detail' | 'settings' | 'admin';

interface NavItem { id: 'home' | 'chat' | 'diary'; label: string; icon: keyof typeof Icon }
const NAV: NavItem[] = [
  { id: 'home', label: '홈', icon: 'home' },
  { id: 'chat', label: '대화', icon: 'chat' },
  { id: 'diary', label: '일기', icon: 'book' },
];

const LANDING_SECTIONS = [
  { id: 'sec-hero', label: '소개' },
  { id: 'sec-record', label: '기록' },
  { id: 'sec-talk', label: '대화' },
  { id: 'sec-safe', label: '안전' },
  { id: 'sec-feat', label: '기능' },
];

const APP_PAGES = [
  { id: 'home', label: '홈' },
  { id: 'chat', label: '대화' },
  { id: 'diary', label: '일기' },
];

interface SidebarProps {
  route: Route;
  go: (r: Route) => void;
  name: string;
  photo?: string | undefined;
  collapsed: boolean;
  onToggle: () => void;
  forceMini?: boolean;
  onLogout?: () => void;
  onSettings?: () => void;
  onAdmin?: () => void;
  isAdmin?: boolean;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function computeStreak(sessionDates: string[]): number {
  const days = new Set(sessionDates.map((s) => s.slice(0, 10)));
  if (days.size === 0) return 0;
  const cursor = new Date();
  if (!days.has(dateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(dateKey(cursor))) return 0;
  }
  let streak = 0;
  while (days.has(dateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function useDiaryStreak(): number | null {
  const { api, isAuthenticated } = useAuth();
  const [streak, setStreak] = useState<number | null>(null);
  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    api.listDiaries(0)
      .then((res) => { if (active) setStreak(computeStreak(res.items.map((d) => d.sessionDate))); })
      .catch(() => { if (active) setStreak(0); });
    return () => { active = false; };
  }, [api, isAuthenticated]);
  return streak;
}

function UserFooter({ name, photo, collapsed, onSettings, onLogout }: { name: string; photo?: string | undefined; collapsed: boolean; onSettings?: (() => void) | undefined; onLogout?: (() => void) | undefined }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const streak = useDiaryStreak();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div className="sidebar-foot" ref={ref} style={{ position: 'relative' }}>
      <button
        className="user-pill"
        title={collapsed ? name : ''}
        onClick={() => setOpen((o) => !o)}
        style={{ width: '100%', cursor: 'pointer', textAlign: 'left', background: open ? 'var(--surface-3)' : undefined }}
      >
        {photo ? (
          <Avatar name={name} photo={photo} />
        ) : (
          <Avatar name={name} />
        )}
        <div className="user-meta" style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>{name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
            {streak !== null && streak > 0 ? `연속 ${streak}일째 🔥` : '오늘의 나를 기록해요'}
          </div>
        </div>
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, right: 0,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, boxShadow: 'var(--shadow-elevated)',
          overflow: 'hidden', zIndex: 50,
        }}>
          <button
            onClick={() => { setOpen(false); onSettings?.(); }}            title={collapsed ? '설정' : ''}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
              gap: 10, width: '100%', padding: collapsed ? '13px' : '13px 16px',
              fontSize: 14, fontWeight: 600, color: 'var(--text-2)',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = '')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {!collapsed && <span>설정</span>}
          </button>

          <div style={{ height: 1, background: 'var(--border)', margin: '0 12px' }} />

          {onLogout && (            <button
              onClick={() => { setOpen(false); onLogout(); }}
              title={collapsed ? '로그아웃' : ''}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
                gap: 10, width: '100%', padding: collapsed ? '13px' : '13px 16px',
                fontSize: 14, fontWeight: 600, color: '#e03535',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#fff0f0')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {!collapsed && <span>로그아웃</span>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ route, go, name, photo, collapsed, onToggle, forceMini = false, onLogout, onSettings, onAdmin, isAdmin }: SidebarProps) {
  const isActive = (id: string) => route === id || (route === 'detail' && id === 'diary');
  return (
    <aside className={'sidebar' + (collapsed ? ' collapsed' : '')}>
      <div className="brand">
        <button className="brand-logo" onClick={() => go('home')} title="홈으로" aria-label="홈으로">
          <LogoImg height={42} />
        </button>
        {!forceMini && (
          <button
            className="side-toggle"
            onClick={onToggle}
            title={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
            aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
          >
            <Icon.chevrons />
          </button>
        )}
      </div>
      {NAV.map((n) => (
        <button
          key={n.id}
          title={collapsed ? n.label : ''}
          className={'nav-item' + (isActive(n.id) ? ' active' : '')}
          onClick={() => go(n.id)}
        >
          <span className="ico">{Icon[n.icon]({})}</span>
          <span className="nav-label">{n.label}</span>
        </button>
      ))}
      {isAdmin && (
        <button
          className={'nav-item' + (route === 'admin' ? ' active' : '')}
          title={collapsed ? '관리자' : ''}
          onClick={onAdmin}
          style={{ color: route === 'admin' ? 'var(--accent)' : undefined }}
        >
          <span className="ico">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          <span className="nav-label">관리자</span>
        </button>
      )}
      <UserFooter name={name} photo={photo} collapsed={collapsed} onLogout={onLogout} onSettings={onSettings} />
    </aside>
  );
}

export function TabBar({ route, go }: { route: Route; go: (r: Route) => void }) {
  const isActive = (id: string) => route === id || (route === 'detail' && id === 'diary');
  return (
    <nav className="tabbar">
      {NAV.map((n) => (
        <button key={n.id} className={'tab' + (isActive(n.id) ? ' active' : '')} onClick={() => go(n.id)}>
          {Icon[n.icon]({ width: 23, height: 23 })}
          <span>{n.label}</span>
        </button>
      ))}
      <button className={'tab' + (route === 'settings' ? ' active' : '')} onClick={() => go('settings')}>
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span>내 정보</span>
      </button>
    </nav>
  );
}

export function MobileTop({ onLogo }: { onLogo?: () => void }) {
  return (
    <div className="mobile-top">
      <button
        onClick={onLogo}
        title="홈으로"
        aria-label="홈으로"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'grid' }}
      >
        <LogoImg height={36} />
      </button>
    </div>
  );
}

export function TopNav({ route, go, name }: { route: Route; go: (r: Route) => void; name: string }) {
  const active = route === 'detail' ? 'diary' : route;
  return (
    <header className="topnav">
      <div className="topnav-inner">
        <button
          className="topnav-brand"
          onClick={() => go('home')}
          title="홈으로"
          aria-label="홈으로"
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          <LogoImg height={39} />
        </button>
        <nav className="topnav-tabs">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={'topnav-tab' + (active === n.id ? ' active' : '')}
              onClick={() => go(n.id)}
            >
              <span className="ico">{Icon[n.icon]({ width: 19, height: 19 })}</span> {n.label}
            </button>
          ))}
        </nav>
        <Avatar name={name} size={36} />
      </div>
    </header>
  );
}

export function GlobalRail({ route, go }: { route: Route; go: (r: Route) => void }) {
  const isLanding = route === 'landing';
  const [activeSec, setActiveSec] = useState('sec-hero');

  useEffect(() => {
    if (!isLanding) return;
    const lp = document.querySelector('.lp');
    if (!lp) return;
    function onScroll() {
      const y = lp!.scrollTop + 140;
      let cur = LANDING_SECTIONS[0]!.id;
      for (const s of LANDING_SECTIONS) {
        const el = document.getElementById(s.id);
        if (el && el.offsetTop <= y) cur = s.id;
      }
      setActiveSec(cur);
    }
    onScroll();
    lp.addEventListener('scroll', onScroll, { passive: true });
    return () => lp.removeEventListener('scroll', onScroll);
  }, [isLanding]);

  if (route === 'login' || route === 'signup') return null;

  if (isLanding) {
    const scrollSec = (id: string) => {
      const el = document.getElementById(id);
      const lp = document.querySelector('.lp');
      if (el && lp) lp.scrollTo({ top: el.offsetTop - 60, behavior: 'smooth' });
    };
    return (
      <div className="app-rail">
        {LANDING_SECTIONS.map((s) => (
          <button
            key={s.id}
            className={'app-tick' + (activeSec === s.id ? ' on' : '')}
            data-label={s.label}
            onClick={() => scrollSec(s.id)}
            aria-label={s.label}
          />
        ))}
      </div>
    );
  }

  const active = route === 'detail' ? 'diary' : route;
  return (
    <div className="app-rail">
      {APP_PAGES.map((r) => (
        <button
          key={r.id}
          className={'app-tick' + (active === r.id ? ' on' : '')}
          data-label={r.label}
          onClick={() => go(r.id as Route)}
          aria-label={r.label}
        />
      ))}
    </div>
  );
}

export function ScrollTopBtn({ route }: { route: Route }) {
  const [show, setShow] = useState(false);
  const sel = route === 'landing' ? '.lp' : '.app-scroll';

  useEffect(() => {
    const el = document.querySelector(sel);
    if (!el) { setShow(false); return; }
    const onScroll = () => setShow(el.scrollTop > 420);
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [sel, route]);

  if (route === 'login' || route === 'signup') return null;

  function toTop() {
    const el = document.querySelector(sel);
    if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <button className={'scroll-top' + (show ? ' show' : '')} onClick={toTop} aria-label="맨 위로">
      <span style={{ display: 'grid', transform: 'rotate(-90deg)' }}><Icon.arrow /></span>
    </button>
  );
}
