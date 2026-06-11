# 나, 다움 (NaDaum)

https://www.nadaum.today/  

> 대화만 하면 일기가 되고, 필요할 때 상담으로 이어지는 **대화형 정서 기록 플랫폼**

「나, 다움」은 사용자가 AI와 텍스트로 대화하면 → 감정 분석 → 공감형 5단계 대화 → 실시간 위험도 평가 → 안전 프로토콜 → 종료 시 **순화된 정서 일기 자동 생성**까지 이어지는 **비의료 정서 지원 서비스**입니다. 도움이 필요한 순간과 실제 상담을 받기까지의 공백을 메우는 것을 목표로 하며, 주 사용자층은 10~30대 청년·청소년입니다.

> ⚠️ 본 서비스는 **비의료 서비스**입니다. 의학적 진단·약물·치료 처방을 제공하지 않으며, 위기 상황에서는 전문 기관 연계를 안내합니다.

`Node.js 20+` · `TypeScript 5 (strict, ESM)` · `Express 5` · `React 18 + Vite` · `PostgreSQL 15+` · `Redis 7+` · `OpenAI / Gemini` · `Vitest + fast-check`

---

## 목차

- [핵심 가치](#핵심-가치)
- [배경 및 문제 정의](#배경-및-문제-정의)
- [타깃 사용자](#타깃-사용자)
- [화면 미리보기](#화면-미리보기)
- [주요 기능](#주요-기능)
- [시스템 아키텍처](#시스템-아키텍처)
- [유저 플로우](#유저-플로우)
- [UML 설계 문서](#uml-설계-문서)
- [유사 서비스와의 차별점](#유사-서비스와의-차별점)
- [기대 효과](#기대-효과)
- [기술 스택](#기술-스택)
- [제품 비전과 현재 구현 범위](#제품-비전과-현재-구현-범위)
- [모노레포 구조](#모노레포-구조)
- [시작하기](#시작하기)
- [로컬 테스트](#로컬-테스트)
- [환경 변수](#환경-변수)
- [명령어](#명령어)
- [개발 방법론](#개발-방법론)
- [핵심 도메인 불변식](#핵심-도메인-불변식)
- [확장 포인트](#확장-포인트-phase-2-호환)
- [팀](#팀)

---

## 핵심 가치

- **부담 없는 정서 기록** — 글쓰기 대신 대화로. 서툰 감정 표현과 글쓰기 피로를 줄입니다.
- **공감형 5단계 대화** — 일방적 위로가 아니라 사용자가 스스로 감정을 마주하고 정리하도록 이끕니다.
- **위기 안전망** — 대화 중·종료 후 실시간 위험도를 평가하고, 위험 수준에 맞는 개입을 제공합니다.
- **상담으로의 브릿지** — 순화된 일기와 구조화된 상담 자료를 생성해 실제 상담의 보조 자료로 활용합니다.
- **확장 가능한 설계** — 감정 채널·위험 신호·산출물·알림을 어댑터 등록만으로 추가하는 플러그인 구조.

---

## 배경 및 문제 정의

현대 사회에서 우울증·번아웃·만성 스트레스가 전 연령대에 걸쳐 급증하고 있습니다. 특히 19~30세 청년층의 우울증 환자는 최근 1년간 **약 225%** 폭증했습니다. 그러나 자체 설문(전 연령대, 4주·29건) 결과 응답자의 **70% 이상**이 심리적 어려움을 겪고 있다고 답한 반면, 실제 전문 상담을 고려한 비율은 **37%**에 그쳤습니다. 상담을 주저하는 이유로는 사회적 낙인, 비용 부담, 기록으로 인한 불이익이 크게 작용했습니다.

디자인 씽킹(AEIOU · 5-Whys · What-How-Why)으로 본질을 파고든 결과, 해결해야 할 **3대 근본 문제**를 도출했습니다.

1. **상담 진입을 가로막는 심리적·구조적 장벽** — 사회적 낙인과 개인정보 노출에 대한 두려움
2. **문제를 방치시키는 대기 공백** — 상담 신청 후 첫 상담까지 평균 수개월의 인프라 병목, 골든타임 상실
3. **일상적 정서 관리 도구의 부재** — 혼자 감정을 언어화해야 하는 일방향적 일기 쓰기의 높은 인지적 피로

---

## 타깃 사용자

학업·취업·업무로 극심한 스트레스를 겪으면서도 내면을 돌볼 여력이 부족한 **10~30대 청년·청소년층**이 핵심 타깃입니다.

| 페르소나 | 핵심 페인포인트 | 필요로 하는 것 |
|---|---|---|
| 취업준비생 김지은 (25) | 기록 노출·취업 불이익에 대한 두려움 | 철저한 익명성 · 개인정보 마스킹 |
| 번아웃 직장인 이민준 (29) | 상담 대기 기간 동안 방치, 감정선 휘발 | 대기 공백 케어 · 구조화된 상담 데이터 |
| 대학 신입생 박서연 (20) | 감정 언어화의 어려움, 일기 작성 피로 | 대화형 인터페이스 · 일기 자동 생성 |

---

## 화면 미리보기

| 랜딩 | 홈 |
|---|---|
| ![Landing](.UI/png-export/Landing%20·%20데스크톱.png) | ![Home](.UI/png-export/Home%20·%20데스크톱.png) |

| 대화 세션 | 일기 목록 |
|---|---|
| ![Session](.UI/png-export/Session%20·%20데스크톱.png) | ![DiaryList](.UI/png-export/DiaryList%20·%20데스크톱.png) |

> 전체 화면(랜딩 · 온보딩 · 회원가입 · 로그인 · 홈 · 세션 · 일기 목록/상세 · 설정)의 데스크톱·모바일 시안은 [`.UI/`](.UI) 폴더에서 확인할 수 있습니다.

---

## 주요 기능

| 도메인 | 설명 |
|---|---|
| 💬 **공감형 대화 엔진** | 상황파악 → 감정탐색 → 생각탐색 → 패턴연결 → 부드러운마무리의 5단계 흐름 |
| 📊 **감정 분석** | 7가지 감정(기쁨·슬픔·분노·불안·놀람·혐오·중립)을 1~10 정수로 산출, 채널별 캘리브레이션 |
| 🛟 **위기 개입 안전망** | 다중 위험 신호의 최댓값 채택(보수적 정책) + 비대칭 전이 + 감사 로그 |
| 📔 **정서 일기 자동 생성** | 세션 종료 시 동의 게이트를 통과한 경우에만 순화된 일기 자동 생성 |
| 🔗 **상담 데이터 구조화** | 일기 + 구조화된 상담 보조 자료 두 형태로 기록 |
| 🔑 **인증·동의** | 이메일/비밀번호 + Google OAuth, 항목별 동의 수집·철회, 보호자 0~5명 등록 |
| 🔒 **개인정보 비식별화** | 외부 AI 전송 전 비식별화 훅(MVP는 무변형 패스스루, 추후 발전과제로 NER 연동 예정) |

---

## 시스템 아키텍처

「나, 다움」 파이프라인은 데이터 흐름에 따라 **사전처리 → 정서분석 → 상호작용 → 기록**의 4계층으로 구성되며, 전 과정이 위험도 평가·안전 프로토콜과 결합되어 동작합니다.

![System Architecture](.UML%20Diagram/Architect.png)

- **사전처리 계층** — 외부 AI로 전송하기 전 개인정보를 비식별화(마스킹)합니다.
- **정서분석 계층** — 텍스트 문맥을 분석해 7가지 감정을 수치화하고, 채널 결과를 캘리브레이션해 실제 정서 상태를 도출합니다.
- **상호작용 계층** — 감정 강도와 맥락을 반영한 공감형 "꼬리물기" 질문을 생성합니다.
- **기록 계층** — 종료된 대화로부터 ① 순화된 **정서 일기**와 ② 전문가용 **구조화된 상담 자료** 두 형태를 생성합니다.

> 모든 외부 AI 호출은 단일 진입점 `AIGateway.callExternalAI()`를 경유합니다.

---

## 유저 플로우

![User Flow](.UML%20Diagram/User%20Flow.png)

1. 로그인 후 홈에서 **기록**과 **대화** 중 선택합니다.
2. 대화 중 **실시간 위험도 평가**가 진행되며, 고위험으로 판단되면 즉시 대화가 종료됩니다.
3. 대화 종료 시 **전체 위험도 평가** 후 수준별로 안내합니다.
   - **저위험** — 일상 팁 제공
   - **중위험** — 상담 서비스 추천 + 지속적 기록 요청
   - **고위험** — 상담·보호자 연결 권유, 24시간 후 안부 확인 + 지속적 기록 요청

---

## UML 설계 문서

[`.UML Diagram/`](.UML%20Diagram) 폴더에 전체 설계 산출물이 PNG/SVG/drawio로 정리되어 있습니다.

| 다이어그램 | 바로가기 |
|---|---|
| 유스케이스 다이어그램 | [UseCase Diagram](.UML%20Diagram/1.%20UseCase%20Diagram/UseCase%20Diagram.png) |
| 유스케이스 명세 | [UseCase Specification](.UML%20Diagram/2.%20UseCase%20Specification/UseCase%20Specification_Final.md) |
| 액티비티 다이어그램 | [Activity 1](.UML%20Diagram/3.%20Activity%20Diagram/Activity%20Diagram1.png) · [2](.UML%20Diagram/3.%20Activity%20Diagram/Activity%20Diagram2.png) · [3](.UML%20Diagram/3.%20Activity%20Diagram/Activity%20Diagram3.png) |
| 클래스 다이어그램 | [Class 2](.UML%20Diagram/4.%20Class%20Diagram/Class%20Diagram2.png) · [3](.UML%20Diagram/4.%20Class%20Diagram/Class%20Diagram3.png) |
| 시퀀스 다이어그램 | [Sequence 2](.UML%20Diagram/5.%20Sequence%20Diagram/Sequence%20Diagram2.png) · [3](.UML%20Diagram/5.%20Sequence%20Diagram/Sequence%20Diagram3.png) |
| 시스템 아키텍처 | [Architect](.UML%20Diagram/Architect.png) |
| 유저 플로우 | [User Flow](.UML%20Diagram/User%20Flow.png) |

---

## 유사 서비스와의 차별점

| 비교 항목 | 나답 | ChatGPT | 마인드카페 | 트로스트 | Wysa | Woebot | **나, 다움** |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 진입 장벽 | 낮음 | 매우 낮음 | 높음(유료) | 높음(유료) | 중간 | 중간 | **낮음(대화로 시작)** |
| 일상 감정 케어 | O | △ | X | O | O | O | **O(대화형)** |
| 전문 상담 연계 | X | X | O | O | O | X | **O(위험도 기반 즉시 연계)** |
| 대기 공백 해소 | X | X | △ | △ | △ | X | **O(대기 중 지속 관리)** |
| 조기 진단 데이터 | X | X | △ | X | △ | △ | **O(전문가용 구조화 자료)** |

---

## 기대 효과

- **사용자** — 일기 작성 부담을 낮춰 감정 표출을 습관화하고, 개인정보 마스킹·표현 순화로 심리적 안전감을 확보합니다.
- **상담사·기관** — 대기 기간의 감정 추이·인지 왜곡 패턴을 구조화된 사전 데이터로 받아 초기 라포 형성과 상황 파악 시간을 단축합니다.
- **사회** — 위기로 넘어가기 전 경계선의 사용자를 보호하는 예방적 정서 지원 생태계를 조성해 상담 인프라 병목을 완화합니다.

---

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 런타임/언어 | Node.js 20+, TypeScript 5 (strict, ES2022/NodeNext, ESM) |
| 백엔드 | Express 5, 도메인 주도 계층 분리(domain/adapters/transport) |
| 프론트엔드 | React 18, Vite |
| 데이터 | PostgreSQL 15+ (영속), Redis 7+ (세션 상태) |
| 외부 AI | OpenAI GPT / Google Gemini, **LangChain(채팅·임베딩 어댑터)** |
| 인증 | JWT, Passport Google OAuth 2.0, scrypt 비밀번호 해시 |
| 테스트 | Vitest, fast-check (속성 기반 테스트) |
| 품질 | ESLint, Prettier |

---

## 제품 비전과 현재 구현 범위

현재 구현된 기능과 추후 발전과제로 남겨진 기능을 구분합니다.

| 영역 | 현재 구현 | 추후 발전과제 |
|---|---|---|
| 입력 | **텍스트 전용** | 음성 입력(STT) |
| 감정 분석 | **텍스트 단일 채널**, 7감정 1~10 | 음성 프로소디(Hume AI) 멀티모달 교차 검증 |
| 개인정보 마스킹 | 훅 인터페이스 정의, **무변형 패스스루** | 온디바이스 NER(KoELECTRA) + 정규식 비식별화 |
| 위험 탐지 | **키워드 신호 + 감정 점수 신호** 조합 | 전용 분류 모델(sentinet/suicidality) |
| 음성 출력 | **텍스트 응답** | TTS(ElevenLabs) |
| 클라이언트 | **React 18 + Vite 웹** | Kotlin Multiplatform 모바일 앱 |
| 데이터 저장 | **PostgreSQL + Redis**, 미설정 시 인메모리 | DocumentDB(비정형 데이터) |

---

## 모노레포 구조

npm workspaces 기반 모노레포입니다.

```
CAIP_NaDaum/
├─ shared/        # @nadaum/shared — 클라이언트 중립 공유 타입 + 정적 콘텐츠
├─ backend/       # @nadaum/backend — Express + 도메인 코어
│  └─ src/
│     ├─ domain/         # 비즈니스 규칙(외부 I/O 없음, 순수 함수 → PBT 대상)
│     ├─ adapters/       # 외부 API/DB 클라이언트(도메인 포트 구현·주입)
│     ├─ transport/      # Express HTTP/WS 핸들러, 인증 미들웨어, OpenAPI
│     ├─ infrastructure/ # Redis 등 인프라 클라이언트
│     └─ boot/           # 합성 루트(composition root)
├─ frontend/      # @nadaum/frontend — React 18 + Vite
│  └─ src/
│     ├─ pages/          # 랜딩·인증·온보딩·홈·세션·일기·설정 화면
│     ├─ components/     # 공통 UI 컴포넌트
│     ├─ api/            # REST 클라이언트
│     ├─ auth/           # 인증 컨텍스트
│     ├─ hooks/          # 커스텀 React 훅
│     ├─ routes/         # 라우팅 설정
│     └─ utils/          # 유틸리티 함수
```

**계층 규칙**: `domain → adapters → transport` 단방향 의존. 도메인은 어댑터를 import하지 않으며, 어댑터가 도메인이 정의한 포트를 구현해 주입됩니다.

---

## 시작하기

### 사전 요구사항

- Node.js 20 이상
- (선택) PostgreSQL 15+, Redis 7+ — **미설정 시 인메모리 모드로 자동 동작**
- (선택) OpenAI 또는 Gemini API 키 — **미설정 시 결정적 페이크 AI로 자동 동작**

### 설치

```bash
git clone <repository-url>
cd CAIP_NaDaum
npm install
```

### 환경 변수 설정

```bash
cp backend/.env.example backend/.env
# backend/.env 를 열어 필요한 값 입력
```

### 백엔드 실행

```bash
# 개발 모드 (tsx watch, 기본 포트 3000)
npm run -w @nadaum/backend dev
```

### 프론트엔드 실행

```bash
# 개발 서버 (Vite, 기본 포트 5173)
npm run -w @nadaum/frontend dev
```

브라우저에서 `http://localhost:5173` 접속하면 됩니다.

---

## 로컬 테스트

DB·Redis·API 키 없이 **인메모리 모드**로 전체 기능을 테스트할 수 있습니다.

### 빠른 시작 (인메모리 모드)

```bash
# 1. 의존성 설치
npm install

# 2. 백엔드 실행 (별도 터미널)
npm run -w @nadaum/backend dev

# 3. 프론트엔드 실행 (별도 터미널)
npm run -w @nadaum/frontend dev
```

기동 로그에 다음이 출력되면 정상입니다:
```
[compose] persistence: db=memory session=memory auth=memory
[nadaum] backend listening on :3000
```

### 테스트 실행

```bash
# 전체 테스트
npm test

# 백엔드 단독
npm test -w @nadaum/backend

# 단일 파일
npm test -w @nadaum/backend -- RiskDecisionFunction
```

### 타입 검사

```bash
npm run typecheck
```

### API 확인

백엔드 실행 후 `http://localhost:3000/openapi.json` 에서 OpenAPI 스펙을 확인할 수 있습니다.

---

## 환경 변수

모든 변수는 **선택**이며, 미설정 시 인메모리/페이크로 대체됩니다. 전체 목록은 `backend/.env.example` 참고.

| 변수 | 설명 | 기본값 |
|---|---|---|
| `JWT_SECRET` | JWT 서명 키 | `dev-insecure-secret-change-me` |
| `DATABASE_URL` | PostgreSQL 연결 문자열 | (없으면 인메모리) |
| `REDIS_URL` | Redis 연결 문자열 | (없으면 인메모리) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | 슈퍼관리자 계정 — 최초 부팅 시 자동 생성 | - |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth | - |
| `BACKEND_URL` / `FRONTEND_URL` | OAuth 리다이렉트 베이스 | `http://localhost:3000` / `http://localhost:5173` |
| `CORS_ORIGIN` | 허용 오리진 | `*` |
| `OPENAI_API_KEY` | OpenAI API 키 | (없으면 페이크) |
| `OPENAI_BASE_URL` | OpenAI 호환 게이트웨이 엔드포인트 | (기본 OpenAI) |
| `OPENAI_MODEL` | 사용할 모델명 | `gpt-5-chat-latest` |
| `GEMINI_API_KEY` | Gemini API 키 (OpenAI보다 우선) | - |
| `GEMINI_MODEL` | Gemini 모델명 | `gemini-2.5-flash` |
| `EMBEDDINGS_ENABLED` | 임베딩 기반 회상 활성화 | `false` |
| `SES_FROM_EMAIL` | 보호자 알림 발신 이메일 (비우면 비활성) | - |
| `AWS_REGION` | AWS 리전 | `ap-northeast-2` |
| `SMS_ALERTS_ENABLED` | 보호자 SMS 알림 활성화 | `false` |

---

## 명령어

```bash
npm run typecheck               # tsc -b (전체 워크스페이스)
npm run build                   # 전체 빌드
npm test                        # 전체 테스트
npm run lint                    # ESLint
npm run format                  # Prettier

npm run -w @nadaum/backend dev  # 백엔드 개발 서버
npm run -w @nadaum/frontend dev # 프론트엔드 개발 서버
npm run -w @nadaum/backend migrate  # DB 마이그레이션
```

---
