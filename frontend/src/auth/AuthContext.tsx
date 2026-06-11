// 토큰 단독 인증 + API 클라이언트 제공
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { createApiClient, type ApiClient } from '../api/client';
import type { AuthResponse, RegisterRequest } from '../api/types';

const TOKEN_KEY    = 'nadaum.token';
const USER_KEY     = 'nadaum.userId';
const PHOTO_KEY    = 'nadaum.photo';
const PROVIDER_KEY = 'nadaum.provider';
const ADMIN_KEY    = 'nadaum.isAdmin';

const nameKey = (userId: string) => `nadaum.name.${userId}`;
const emailKey = (userId: string) => `nadaum.email.${userId}`;

const onboardedKey = (userId: string): string => `nadaum.onboarded.${userId}`;

export function isUserOnboarded(userId: string | undefined): boolean {
  if (userId === undefined || typeof localStorage === 'undefined') return false;
  return localStorage.getItem(onboardedKey(userId)) === '1';
}

type AuthProvider = 'local' | 'google';

interface AuthState {
  readonly token:    string | undefined;
  readonly userId:   string | undefined;
  readonly name:     string | undefined;
  readonly email:    string | undefined;
  readonly photo:    string | undefined;
  readonly provider: AuthProvider | undefined;
  readonly isAdmin:  boolean;
}

export interface AuthContextValue {
  readonly token:    string | undefined;
  readonly userId:   string | undefined;
  readonly name:     string | undefined;
  readonly email:    string | undefined;
  readonly photo:    string | undefined;
  readonly provider: AuthProvider | undefined;
  readonly isAuthenticated: boolean;
  readonly isAdmin:  boolean;
  readonly api: ApiClient;
  register(body: RegisterRequest, name?: string): Promise<void>;
  login(email: string, password: string): Promise<void>;
  setName(n: string): void;
  completeOnboarding(): void;
  readonly isOnboarded: boolean;
  logout(): void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readInitial(): AuthState {
  if (typeof localStorage === 'undefined') return { token: undefined, userId: undefined, name: undefined, email: undefined, photo: undefined, provider: undefined, isAdmin: false };
  const userId = localStorage.getItem(USER_KEY) ?? undefined;
  return {
    token:    localStorage.getItem(TOKEN_KEY)    ?? undefined,
    userId,
    name:     userId !== undefined ? (localStorage.getItem(nameKey(userId)) ?? undefined) : undefined,
    email:    userId !== undefined ? (localStorage.getItem(emailKey(userId)) ?? undefined) : undefined,
    photo:    localStorage.getItem(PHOTO_KEY)    ?? undefined,
    provider: (localStorage.getItem(PROVIDER_KEY) as AuthProvider | null) ?? undefined,
    isAdmin:  localStorage.getItem(ADMIN_KEY) === '1',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(readInitial);
  const tokenRef = useRef<string | undefined>(state.token);
  tokenRef.current = state.token;

  const api = useMemo<ApiClient>(() => createApiClient(() => tokenRef.current), []);

  const persist = useCallback((res: AuthResponse, name?: string, email?: string): void => {
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(USER_KEY, res.userId);
    const incomingName = name ?? res.name;
    if (incomingName !== undefined && incomingName.length > 0) localStorage.setItem(nameKey(res.userId), incomingName);
    const incomingEmail = email ?? res.email;
    if (incomingEmail !== undefined && incomingEmail.length > 0) localStorage.setItem(emailKey(res.userId), incomingEmail);
    localStorage.removeItem(PHOTO_KEY);
    localStorage.setItem(PROVIDER_KEY, 'local');
    if (res.isAdmin) localStorage.setItem(ADMIN_KEY, '1');
    else localStorage.removeItem(ADMIN_KEY);
    const resolvedName = incomingName ?? (localStorage.getItem(nameKey(res.userId)) ?? undefined);
    const resolvedEmail = incomingEmail ?? (localStorage.getItem(emailKey(res.userId)) ?? undefined);
    setState({ token: res.token, userId: res.userId, name: resolvedName, email: resolvedEmail, photo: undefined, provider: 'local', isAdmin: res.isAdmin === true });
  }, []);

  const register = useCallback(
    async (body: RegisterRequest, name?: string): Promise<void> => {
      persist(await api.register(body), name, body.email);
    },
    [api, persist],
  );

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      persist(await api.login({ email, password }), undefined, email);
    },
    [api, persist],
  );

  const setName = useCallback((n: string): void => {
    setState((s) => {
      if (s.userId !== undefined) localStorage.setItem(nameKey(s.userId), n);
      return { ...s, name: n };
    });
  }, []);

  const [onboardedTick, setOnboardedTick] = useState(0);
  const completeOnboarding = useCallback((): void => {
    if (state.userId !== undefined) {
      localStorage.setItem(onboardedKey(state.userId), '1');
      setOnboardedTick((t) => t + 1);
    }
  }, [state.userId]);

  const logout = useCallback((): void => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(PHOTO_KEY);
    localStorage.removeItem(PROVIDER_KEY);
    localStorage.removeItem(ADMIN_KEY);
    setState({ token: undefined, userId: undefined, name: undefined, email: undefined, photo: undefined, provider: undefined, isAdmin: false });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token:    state.token,
      userId:   state.userId,
      name:     state.name,
      email:    state.email,
      photo:    state.photo,
      provider: state.provider,
      isAuthenticated: state.token !== undefined,
      isAdmin:  state.isAdmin,
      isOnboarded: isUserOnboarded(state.userId),
      api,
      register,
      login,
      setName,
      completeOnboarding,
      logout,
    }),
    [state, api, register, login, setName, completeOnboarding, logout, onboardedTick],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
