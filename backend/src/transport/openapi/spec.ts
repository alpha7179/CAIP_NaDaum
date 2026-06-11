// OpenAPI 3.1 명세 발행

export type OpenApiSpec = Record<string, unknown>;

const jsonContent = (schemaRef: string): Record<string, unknown> => ({
  'application/json': { schema: { $ref: schemaRef } },
});

export function buildOpenApiSpec(baseUrl = '/'): OpenApiSpec {
  return {
    openapi: '3.1.0',
    info: {
      title: '나,다움 (NaDaum) Platform API',
      version: '0.1.0',
      description:
        '클라이언트 중립 REST/실시간 API. 쿠키 없이 Bearer 토큰 단독 인증을 사용하며, ' +
        '모든 요청·응답은 JSON이다. 발화는 텍스트로 전달한다. 본 명세로부터 웹(React) 및 ' +
        '모바일(iOS/Android, Kotlin Multiplatform) 클라이언트 SDK를 자동 생성할 수 있다.',
    },
    servers: [{ url: baseUrl }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['error'],
          properties: { error: { type: 'string' }, code: { type: 'string' } },
        },
        RegisterRequest: {
          type: 'object',
          required: ['email', 'password', 'consentItems'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
            name: { type: 'string' },
            consentItems: {
              type: 'object',
              properties: {
                privacyPolicy: { type: 'boolean' },
                nonMedicalDisclaimer: { type: 'boolean' },
                guardianNotification: { type: 'boolean' },
              },
            },
            guardians: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  relationship: { type: 'string' },
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  phone: { type: 'string', pattern: '^\\+[1-9]\\d{1,14}$' },
                  emailEnabled: { type: 'boolean' },
                  smsEnabled: { type: 'boolean' },
                },
              },
            },
          },
        },
        AuthResponse: {
          type: 'object',
          required: ['userId', 'token'],
          properties: { userId: { type: 'string' }, token: { type: 'string' } },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
        StartSessionResponse: {
          type: 'object',
          required: ['sessionId', 'stage'],
          properties: { sessionId: { type: 'string' }, stage: { type: 'string' } },
        },
        UtteranceRequest: {
          type: 'object',
          required: ['text'],
          description:
            '텍스트 직접 입력(text)으로 발화를 전달한다. ' +
            '웹 전용 자료형(File/Blob/FormData)에 의존하지 않는다.',
          properties: {
            text: { type: 'string' },
          },
        },
        DiaryEntry: {
          type: 'object',
          properties: {
            diaryId: { type: 'string' },
            userId: { type: 'string' },
            sessionId: { type: 'string' },
            sessionDate: { type: 'string', format: 'date' },
            title: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            bodyType: { type: 'string', enum: ['full', 'brief'] },
            body: { type: 'string' },
            emotionScores: { type: 'object' },
            peakRiskLevel: { type: 'string', enum: ['저위험', '중위험', '고위험'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        MentalHealthResources: {
          type: 'object',
          properties: {
            emergencyContacts: { type: 'array', items: { type: 'object' } },
            counselingReferrals: { type: 'array', items: { type: 'object' } },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      '/auth/register': {
        post: {
          summary: '회원가입 + 동의 + 보호자 등록',
          security: [],
          requestBody: { required: true, content: jsonContent('#/components/schemas/RegisterRequest') },
          responses: {
            '201': { description: 'created', content: jsonContent('#/components/schemas/AuthResponse') },
            '400': { description: 'validation error', content: jsonContent('#/components/schemas/Error') },
          },
        },
      },
      '/auth/check-email': {
        get: {
          summary: '이메일(아이디) 중복 실시간 확인',
          security: [],
          parameters: [{ name: 'email', in: 'query', required: true, schema: { type: 'string', format: 'email' } }],
          responses: {
            '200': {
              description: 'availability',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { available: { type: 'boolean' } },
                    required: ['available'],
                  },
                },
              },
            },
            '400': { description: 'invalid email', content: jsonContent('#/components/schemas/Error') },
          },
        },
      },
      '/auth/login': {
        post: {
          summary: '로그인(토큰 발급)',
          security: [],
          requestBody: { required: true, content: jsonContent('#/components/schemas/LoginRequest') },
          responses: {
            '200': { description: 'ok', content: jsonContent('#/components/schemas/AuthResponse') },
            '401': { description: 'invalid credentials', content: jsonContent('#/components/schemas/Error') },
          },
        },
      },
      '/auth/withdraw-consent': {
        post: {
          summary: '동의 철회',
          requestBody: { required: false, content: jsonContent('#/components/schemas/Error') },
          responses: { '204': { description: 'no content' }, '401': { description: 'unauthorized' } },
        },
      },
      '/me/notification-preferences': {
        get: {
          summary: '보호자 안전 알림 채널 설정 조회 (이메일/SMS on·off)',
          responses: { '200': { description: 'ok' }, '401': { description: 'unauthorized' } },
        },
        patch: {
          summary: '보호자 안전 알림 채널 설정 갱신',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    emailEnabled: { type: 'boolean' },
                    smsEnabled: { type: 'boolean' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'updated' }, '401': { description: 'unauthorized' } },
        },
      },
      '/me/guardians': {
        get: {
          summary: '보호자 목록 조회',
          responses: { '200': { description: 'ok' }, '401': { description: 'unauthorized' } },
        },
        put: {
          summary: '보호자 목록 전체 교체(저장)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    guardians: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          relationship: { type: 'string' },
                          name: { type: 'string' },
                          email: { type: 'string', format: 'email' },
                          phone: { type: 'string', pattern: '^\\+[1-9]\\d{1,14}$' },
                          emailEnabled: { type: 'boolean' },
                          smsEnabled: { type: 'boolean' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'saved' },
            '400': { description: 'validation error', content: jsonContent('#/components/schemas/Error') },
            '401': { description: 'unauthorized' },
          },
        },
      },
      '/sessions': {
        post: {
          summary: '세션 시작',
          responses: {
            '201': { description: 'created', content: jsonContent('#/components/schemas/StartSessionResponse') },
            '403': { description: 'not eligible', content: jsonContent('#/components/schemas/Error') },
          },
        },
      },
      '/sessions/{id}/utterances': {
        post: {
          summary: '발화 처리(텍스트 → 감정/대화/위험)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: { required: true, content: jsonContent('#/components/schemas/UtteranceRequest') },
          responses: {
            '200': { description: 'processed' },
            '400': { description: 'invalid input', content: jsonContent('#/components/schemas/Error') },
            '404': { description: 'session not found', content: jsonContent('#/components/schemas/Error') },
          },
        },
      },
      '/sessions/{id}/end': {
        post: {
          summary: '세션 종료',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'ended' }, '404': { description: 'not found' } },
        },
      },
      '/diaries': {
        get: {
          summary: '일기 목록(최신순, 페이지당 10)',
          parameters: [{ name: 'page', in: 'query', schema: { type: 'integer', minimum: 0 } }],
          responses: { '200': { description: 'ok' } },
        },
      },
      '/diaries/{id}': {
        get: {
          summary: '단일 일기',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'ok', content: jsonContent('#/components/schemas/DiaryEntry') },
            '404': { description: 'not found' },
          },
        },
      },
      '/diaries/trend': {
        get: {
          summary: '감정 추이(최근 N세션)',
          parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1 } }],
          responses: { '200': { description: 'ok' } },
        },
      },
      '/resources/mental-health': {
        get: {
          summary: '전문 정신건강 자원(위기 상담 전화·상담 기관)',
          security: [],
          responses: {
            '200': { description: 'ok', content: jsonContent('#/components/schemas/MentalHealthResources') },
          },
        },
      },
    },
  };
}
