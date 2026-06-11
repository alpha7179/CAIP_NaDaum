// Google OAuth 콜백 처리 (토큰 저장 후 홈 이동)
import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { WaveOrb } from '../components/WaveOrb';

export function OAuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate  = useNavigate();
  const done      = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const token  = params.get('token');
    const userId = params.get('userId');
    const name   = params.get('name');
    const email  = params.get('email');
    const photo  = params.get('photo');
    const isAdmin = params.get('isAdmin');
    const error  = params.get('error');

    if (error !== null || token === null) {
      navigate('/login?error=oauth_failed', { replace: true });
      return;
    }

    localStorage.setItem('nadaum.token', token);
    localStorage.setItem('nadaum.provider', 'google');
    if (isAdmin === '1') localStorage.setItem('nadaum.isAdmin', '1');
    else localStorage.removeItem('nadaum.isAdmin');
    if (userId !== null) {
      localStorage.setItem('nadaum.userId', userId);
      if (name !== null && name.length > 0) {
        localStorage.setItem(`nadaum.name.${userId}`, name);
      }
      if (email !== null && email.length > 0) {
        localStorage.setItem(`nadaum.email.${userId}`, email);
      }
    }
    if (photo !== null && photo.length > 0) localStorage.setItem('nadaum.photo', photo);
    else localStorage.removeItem('nadaum.photo');

    window.location.replace('/home');
  }, [params, navigate]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16 }}>
      <WaveOrb size={100} active />
      <p style={{ fontSize: 15, color: 'var(--text-2)', fontWeight: 600 }}>로그인 처리 중…</p>
    </div>
  );
}
