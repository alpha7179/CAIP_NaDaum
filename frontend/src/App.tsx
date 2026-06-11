// React Router 기반 URL 라우팅
import { useEffect, useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { Routes, Route } from 'react-router-dom';

import { AuthProvider, useAuth } from './auth/AuthContext';
import {
  Sidebar, TabBar, MobileTop, TopNav,
} from './components/AppShell';
import { AdminPage } from './pages/AdminPage';
import { LoginPage, SignupPage } from './pages/AuthPages';
import { DiaryList, DiaryDetail } from './pages/DiaryPages';
import { HomePage } from './pages/HomePage';
import { LandingPage } from './pages/LandingPage';
import { OAuthCallbackPage } from './pages/OAuthCallbackPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { SessionPage } from './pages/SessionPage';
import { SettingsPage } from './pages/SettingsPage';

type Route = 'landing' | 'login' | 'signup' | 'home' | 'chat' | 'diary' | 'detail' | 'settings' | 'admin';
type NavLayout = '사이드바' | '상단바' | '미니레일';

function hexToRgb(h: string) {
  const s = h.replace('#', '');
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(', ');
}
function shade(h: string, amt: number) {
  const s = h.replace('#', '');
  const r = Math.max(0, Math.min(255, parseInt(s.slice(0, 2), 16) + amt));
  const g = Math.max(0, Math.min(255, parseInt(s.slice(2, 4), 16) + amt));
  const b = Math.max(0, Math.min(255, parseInt(s.slice(4, 6), 16) + amt));
  const c = (x: number) => x.toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
}

function RequireOnboarded({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isOnboarded } = useAuth();
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!isOnboarded) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!isAdmin) return <Navigate to="/home" replace />;
  return <>{children}</>;
}

function AppShellLayout({ children, route }: { children: React.ReactNode; route: Route }) {
  const navigate = useNavigate();
  const { name, photo, logout, isAdmin } = useAuth();
  const nm = name ?? '나';
  const [navLayout] = useState<NavLayout>('사이드바');
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('nadaum_side') === '1'; } catch { return false; }
  });

  function go(r: string) {
    const map: Record<string, string> = {
      home: '/home', chat: '/chat', diary: '/diary', settings: '/settings',
      landing: '/', login: '/login', signup: '/register', admin: '/admin',
    };
    navigate(map[r] ?? '/');
  }

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <div className="app">
      {navLayout !== '상단바' && (
        <Sidebar
          route={route}
          go={(r) => go(r)}
          name={nm}
          photo={photo}
          collapsed={navLayout === '미니레일' ? true : collapsed}
          onToggle={() => setCollapsed((c) => {
            const n = !c;
            try { localStorage.setItem('nadaum_side', n ? '1' : '0'); } catch {}
            return n;
          })}
          forceMini={navLayout === '미니레일'}
          onLogout={handleLogout}
          onSettings={() => navigate('/settings')}
          onAdmin={() => navigate('/admin')}
          isAdmin={isAdmin}
        />
      )}
      <div style={{ flex: 1, height: '100vh', display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
        {navLayout === '상단바' && <TopNav route={route} go={(r) => go(r)} name={nm} />}
        <MobileTop onLogo={() => go('home')} />
        {children}
      </div>
      <TabBar route={route} go={(r) => go(r)} />
    </div>
  );
}

function DiaryDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  function go(r: string, p?: string) {
    if (r === 'chat') navigate('/chat');
    else if (r === 'diary') navigate('/diary');
    else if (r === 'detail' && p) navigate(`/diary/${p}`);
  }
  return <DiaryDetail go={go} back={() => navigate('/diary')} id={id ?? null} />;
}

function AppInner() {
  const navigate = useNavigate();
  const [theme] = useState<'light' | 'dark'>('light');
  const [accent] = useState('#1faa6a');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent', accent);
    r.style.setProperty('--accent-rgb', hexToRgb(accent));
    r.style.setProperty('--accent-press', shade(accent, -18));
    r.style.setProperty('--accent-soft', `rgba(${hexToRgb(accent)}, 0.10)`);
  }, [accent]);

  function go(r: string, p?: string) {
    const map: Record<string, string> = {
      landing: '/', login: '/login', signup: '/register',
      home: '/home', chat: '/chat', diary: '/diary',
    };
    if (r === 'detail' && p) navigate(`/diary/${p}`);
    else navigate(map[r] ?? '/');
  }

  return (
    <Routes>
      <Route path="/" element={
        <div className="app"><LandingPage go={go} /></div>
      } />
      <Route path="/login" element={
        <div className="app"><LoginPage go={go} /></div>
      } />
      <Route path="/register" element={
        <div className="app"><SignupPage go={go} /></div>
      } />
      <Route path="/oauth" element={<OAuthCallbackPage />} />

      <Route path="/onboarding" element={
        <RequireAuth>
          <div className="app"><OnboardingPage /></div>
        </RequireAuth>
      } />

      <Route path="/home" element={
        <RequireOnboarded>
          <AppShellLayout route="home">
            <div className="app-scroll">
              <HomePage go={go} />
            </div>
          </AppShellLayout>
        </RequireOnboarded>
      } />
      <Route path="/chat" element={
        <RequireOnboarded>
          <AppShellLayout route="chat">
            <div className="homechat-root">
              <SessionPage go={go} />
            </div>
          </AppShellLayout>
        </RequireOnboarded>
      } />
      <Route path="/diary" element={
        <RequireOnboarded>
          <AppShellLayout route="diary">
            <div className="app-scroll">
              <DiaryList go={go} />
            </div>
          </AppShellLayout>
        </RequireOnboarded>
      } />
      <Route path="/diary/:id" element={
        <RequireOnboarded>
          <AppShellLayout route="detail">
            <DiaryDetailPage />
          </AppShellLayout>
        </RequireOnboarded>
      } />
      <Route path="/settings" element={
        <RequireOnboarded>
          <AppShellLayout route="settings">
            <div className="app-scroll">
              <SettingsPage />
            </div>
          </AppShellLayout>
        </RequireOnboarded>
      } />

      <Route path="/admin" element={
        <RequireAdmin>
          <AppShellLayout route="settings">
            <div className="app-scroll">
              <AdminPage />
            </div>
          </AppShellLayout>
        </RequireAdmin>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
