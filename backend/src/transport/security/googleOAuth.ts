// Google OAuth2 Passport 전략

import type { Router } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

import type { AuthApi, AuthResult } from '../ports.js';

export interface GoogleOAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly backendUrl: string;
  readonly frontendUrl: string;
  readonly auth: AuthApi;
}

export function setupGoogleOAuth(router: Router, cfg: GoogleOAuthConfig): void {
  passport.use(
    new GoogleStrategy(
      {
        clientID: cfg.clientId,
        clientSecret: cfg.clientSecret,
        callbackURL: `${cfg.backendUrl}/auth/google/callback`,
        scope: ['profile', 'email'],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value ?? `${profile.id}@google.oauth`;
          const name = profile.displayName ?? 'Google User';
          const photo = profile.photos?.[0]?.value ?? undefined;
          const result: AuthResult = await cfg.auth.loginWithGoogle(profile.id, email, name, photo);
          done(null, { ...result, name, email, photo });
        } catch (err) {
          done(err as Error);
        }
      },
    ),
  );

  router.get(
    '/auth/google',
    passport.authenticate('google', { session: false, scope: ['profile', 'email'] }),
  );

  router.get(
    '/auth/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: `${cfg.frontendUrl}/login?error=oauth_failed` }),
    (req, res) => {
      const result = req.user as AuthResult & { name?: string; email?: string; photo?: string };
      const params = new URLSearchParams({
        token: result.token,
        userId: result.userId,
        ...(result.name  ? { name:  result.name  } : {}),
        ...(result.email ? { email: result.email } : {}),
        ...(result.photo ? { photo: result.photo } : {}),
        ...(result.isAdmin ? { isAdmin: '1' } : {}),
      });
      res.redirect(`${cfg.frontendUrl}/oauth?${params.toString()}`);
    },
  );
}
