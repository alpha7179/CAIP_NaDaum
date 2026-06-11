// OpenAPI 명세 빌더 단위 테스트
import { describe, expect, it } from 'vitest';

import { buildOpenApiSpec } from './spec.js';

describe('buildOpenApiSpec', () => {
  it('is OpenAPI 3.1 with bearer auth security scheme', () => {
    const spec = buildOpenApiSpec() as Record<string, any>;
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
  });

  it('declares all user-facing endpoints', () => {
    const spec = buildOpenApiSpec() as Record<string, any>;
    const paths = Object.keys(spec.paths);
    for (const p of [
      '/auth/register',
      '/auth/login',
      '/auth/withdraw-consent',
      '/sessions',
      '/sessions/{id}/utterances',
      '/sessions/{id}/end',
      '/diaries',
      '/diaries/{id}',
      '/diaries/trend',
      '/resources/mental-health',
    ]) {
      expect(paths).toContain(p);
    }
  });

  it('mentions mobile client SDK generation', () => {
    const spec = buildOpenApiSpec() as Record<string, any>;
    expect(String(spec.info.description)).toMatch(/모바일|Kotlin/);
  });
});
