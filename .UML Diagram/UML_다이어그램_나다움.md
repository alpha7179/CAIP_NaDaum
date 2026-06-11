# 「나,다움」 UML 다이어그램

> 설계 문서(design.md) 기반 UML 5종 다이어그램
> 유스케이스 다이어그램 → 유스케이스 명세서 → 액티비티 다이어그램 → 클래스 다이어그램 → 시퀀스 다이어그램

---

## 1. 유스케이스 다이어그램 (Use Case Diagram)

### 시스템 경계: 「나,다움」 플랫폼 (System Architecture)

```mermaid
graph LR
    %% ===== Actors =====
    내담자(("👤<br/>내담자<br/>(사용자)"))
    보호자(("👤<br/>보호자<br/>(Secondary)"))
    상담사(("👤<br/>심리 상담사<br/>(Secondary)"))

    subgraph SYS["System Architecture"]
        direction TB

        %% ----- 대화 세션 -----
        subgraph 대화["대화 세션"]
            UC01(("UC-01<br/>대화 기반 내면 탐색<br/>(AI 통화)"))
            STT((STT 변환))
            MASK((개인정보 마스킹))
            MULTI((실시간 멀티모달<br/>심리 상태 분석))
            CRISIS((실시간 위기<br/>상황 감지))
            FOLLOW((꼬리물기 질문 생성))
            TTS((TTS 변환))
            REC((대화 기록 생성))
            DIARY((일기 생성))
            DOC((상담용 문서 생성))
        end

        %% ----- 사용자 인증 세션 -----
        subgraph 인증["사용자 인증 세션"]
            SIGNUP((회원 가입))
            LOGIN((로그인))
            GUARD((보호자 등록))
            ADDR((주소지 등록))
            CONSENT((개인정보 수집 동의<br/>및 비의료 서비스 안내))
        end

        %% ----- 포스트프로세스 세션 -----
        subgraph POST["포스트프로세스(종합 평가 및 안전망) 세션"]
            UCC2(("UC-C2<br/>종합 위험도 평가<br/>및 안전망 연결"))
            TIP((일상 팁 제공))
            REFER((상담 서비스 추천))
            ALARM((안부 및 재대화 알림))
            CONNECT((상담 연결))
            GCONNECT((보호자 연결))
        end

        %% ----- 기록 관리 세션 -----
        subgraph 기록["기록 관리 세션"]
            UCC3(("UC-C3<br/>대화 기록 관리"))
            DMANAGE((일기 관리))
            DVIEW((일기 조회))
            DEDIT((일기 수정))
            DDEL((일기 삭제))
            DSHARE((일기 공유))
            DOCMNG((문서 관리))
            DOCVIEW((문서 조회))
            DOCSHARE((문서 공유))
        end
    end

    %% ===== Actor associations =====
    내담자 --- UC01
    내담자 --- REC
    내담자 --- LOGIN
    내담자 --- UCC3
    보호자 --- GCONNECT
    상담사 --- DOCMNG

    %% ===== 대화 세션 includes =====
    UC01 -.->|initiate| STT
    UC01 -.->|include| MASK
    UC01 -.->|include| MULTI
    UC01 -.->|include| CRISIS
    UC01 -.->|include| FOLLOW
    UC01 -.->|include| TTS
    REC -.->|include| DIARY
    REC -.->|include| DOC

    %% ===== 인증 세션 =====
    LOGIN -.->|include| SIGNUP
    LOGIN -.->|"extend [최초 로그인]"| GUARD
    LOGIN -.->|"extend [최초 가입]"| ADDR
    LOGIN -.->|"extend [최초 로그인]"| CONSENT

    %% ===== 포스트프로세스: extend → UC-C2 =====
    TIP -.->|"extend [저위험]"| UCC2
    REFER -.->|"extend [중위험]"| UCC2
    ALARM -.->|"extend [중위험]"| UCC2
    CONNECT -.->|"extend [고위험]"| UCC2
    GCONNECT -.->|"extend [고위험]"| UCC2

    %% ===== 기록 관리 세션 =====
    UCC3 --> DMANAGE
    UCC3 --> DOCMNG
    DMANAGE --> DVIEW
    DMANAGE --> DEDIT
    DMANAGE --> DDEL
    DMANAGE --> DSHARE
    DOCMNG --> DOCVIEW
    DOCMNG --> DOCSHARE

    classDef talk fill:#d5f5e3,stroke:#27ae60;
    classDef auth fill:#eaecee,stroke:#7f8c8d;
    classDef post fill:#fdebd0,stroke:#e67e22;
    classDef rec fill:#d6eaf8,stroke:#2980b9;
    class UC01,STT,MASK,MULTI,CRISIS,FOLLOW,TTS,REC,DIARY,DOC talk;
    class SIGNUP,LOGIN,GUARD,ADDR,CONSENT auth;
    class UCC2,TIP,REFER,ALARM,CONNECT,GCONNECT post;
    class UCC3,DMANAGE,DVIEW,DEDIT,DDEL,DSHARE,DOCMNG,DOCVIEW,DOCSHARE rec;
```

### 액터 정의

| 액터 | 역할 | 유형 |
|------|------|------|
| 내담자(사용자) | 음성 대화로 감정을 탐색·기록하고 일기/문서를 관리하는 주 사용자 (10~30대) | Primary |
| 보호자 | 고위험 상황에서 알림을 받고 연결되는 보호 대상 연락처 | Secondary |
| 심리 상담사 | 상담용 문서를 열람·공유받는 외부 전문 인력 | Secondary |

### 세션(패키지) 구성

| 세션 | 핵심 유스케이스 | 색상 |
|------|----------------|------|
| 대화 세션 | UC-01 대화 기반 내면 탐색(AI 통화) — STT/마스킹/멀티모달 분석/위기 감지/꼬리물기/TTS 포함, 대화 기록 생성→일기·상담문서 | 초록 |
| 사용자 인증 세션 | 로그인 — 회원 가입 include, 최초 로그인 시 보호자 등록·주소지 등록·동의 안내 extend | 회색 |
| 포스트프로세스 세션 | UC-C2 종합 위험도 평가 및 안전망 연결 — 저/중/고위험 등급별 개입 extend | 주황 |
| 기록 관리 세션 | UC-C3 대화 기록 관리 — 일기 관리(조회/수정/삭제/공유), 문서 관리(조회/공유) | 파랑 |

### 유스케이스 관계 설명

| 관계 | 설명 |
|------|------|
| UC-01 `<<include>>` STT/마스킹/멀티모달/위기감지/꼬리물기/TTS | AI 통화 1회에 6개 기능 항상 수행 |
| 대화 기록 생성 `<<include>>` 일기 생성 / 상담용 문서 생성 | 세션 종료 시 두 산출물 생성 |
| 로그인 `<<include>>` 회원 가입 | 로그인 흐름에 가입 포함 |
| 로그인 `<<extend>>` 보호자 등록 / 주소지 등록 / 동의 안내 | 최초 로그인 조건에서만 확장 |
| 일상 팁 제공 `<<extend>>` UC-C2 `[저위험]` | 저위험 등급에서만 |
| 상담 서비스 추천 · 안부/재대화 알림 `<<extend>>` UC-C2 `[중위험]` | 중위험 등급에서만 |
| 상담 연결 · 보호자 연결 `<<extend>>` UC-C2 `[고위험]` | 고위험 등급에서만, 보호자 연결은 보호자 액터로 연결 |

---

## 2. 유스케이스 명세서 (Use Case Specification)

### UC-01: 음성 대화 시작 및 진행

```
유스케이스 이름: 음성 대화 시작 및 진행
액터: 사용자(내담자)
목표: 음성 대화를 통해 감정을 탐색하고 표현하여 정서 일기를 자동 생성받는다
시작 조건: 사용자가 필수 동의를 완료하고 로그인된 상태여야 한다

정상적 사건의 흐름:
1. 사용자가 '대화하기' 버튼을 눌러 세션을 시작한다.
2. 플랫폼이 비의료 서비스 면책 고지를 표시한다.
3. 사용자가 마이크를 활성화하고 음성으로 발화한다.
4. 사전처리_엔진이 음성을 Whisper STT로 변환하여 5초 이내에 텍스트를 표시한다.
5. 감정_분석기가 텍스트를 GPT-4o로 분석하여 7가지 감정 점수를 산출한다.
6. 대화_엔진이 5단계 흐름(상황파악→감정탐색→생각탐색→패턴연결→마무리)에 따라
   맥락 적합 응답을 10초 이내에 생성한다.
7. 위험_평가기가 발화를 고위험 키워드 및 감정 임계치와 대조 평가한다.
8. 위험 수준이 저위험이면 AI 응답을 사용자에게 전달하고 3~7을 반복한다.
9. 사용자가 종료 의사를 표현하면 대화_엔진이 마무리 단계로 전환한다.
10. 세션 종료 후 기록_생성기가 30초 이내에 정서_일기를 자동 생성한다.
11. 안전_프로토콜이 저위험 판정에 따라 일상 웰니스 팁 1~3개를 제공한다.

대안 흐름:
A1: 고위험 감지
  1. 정상 흐름 7단계에서 고위험 키워드 탐지 또는 불안/분노 ≥ 9일 때 시작한다.
  2. 안전_프로토콜이 5초 이내에 긴급 전문 기관(1393, 1577-0199) 연락처를
     화면 상단에 고정 표시하고 강한 경고 메시지를 표시한다.
  3. 세션이 즉시 마무리 단계로 강제 전환된다.
  4. 감사 로그에 고위험 개입 이벤트를 기록한다.

A2: 중위험 감지
  1. 정상 흐름 7단계에서 불안 또는 분노 ≥ 8이나 고위험 키워드 미탐지일 때 시작한다.
  2. 안전_프로토콜이 5초 이내에 전문 상담 서비스 추천 및 상담 기관 연락처를 안내한다.
  3. 대화는 계속 진행 가능하다.

A3: STT 변환 실패
  1. 정상 흐름 4단계에서 Whisper 호출이 실패하면 시작한다.
  2. 최대 2회 재시도를 수행한다.
  3. 재시도 실패 시 텍스트 직접 입력 대안을 제시한다.

A4: 의료 키워드 감지
  1. 정상 흐름 6단계에서 사용자 발화에 의료 관련 키워드가 포함되면 시작한다.
  2. 대화_엔진이 비의료 서비스 안내 + 전문 정신건강 상담 기관 이용 권유 응답을 생성한다.
  3. 정상 흐름 8단계로 복귀한다.

A5: 침묵 타임아웃
  1. 사용자가 60초 이상 침묵하면 시작한다.
  2. 대화를 계속하거나 종료할 것인지 안내한다.
  3. 추가 60초 동안 응답이 없으면 세션을 자동 종료한다.

종료조건: 세션이 정상 종료되면 정서_일기가 생성되어 저장되고,
         위험 평가 결과 및 개입 조치가 감사 로그에 기록된다.
```

---

## 3. 액티비티 다이어그램 (Activity Diagram)

> 액터 스윔레인: **User**(사용자) / **System**(플랫폼). 처리 계층은 색상으로 구분한다.
> 사전처리(주황) · 기록(초록) · 안전 프로토콜(빨강) · 상호작용(보라).

### 3-1. UC-01 대화 세션 액티비티

```mermaid
flowchart TD
    start((●)) --> access[대화하기 접속]:::user
    access --> initSession[마이크 활성화<br/>세션 시작]
    speak[음성으로 감정/상황 말하기]:::user

    %% 사전처리 계층
    initSession --> stt["STT<br/>(OpenAI API)"]:::pre
    speak --> stt
    stt --> sttCheck{음성 인식 결과}
    sttCheck -->|"[음성 인식 실패]"| retry[재시도 안내]
    retry --> speak
    sttCheck -->|"[음성인식 성공]"| ner["KoELECTRA NER<br/>개인정보 자동 마스킹"]:::pre

    %% 기록 계층 (감정 분석)
    ner --> fork1[" fork "]:::bar
    fork1 --> textAn["OpenAI API<br/>텍스트 문맥 분석"]:::rec
    fork1 --> voiceAn["Hume AI Prosody<br/>음성 분석"]:::rec
    textAn --> join1[" join "]:::bar
    voiceAn --> join1
    join1 --> calib["캘리브레이션<br/>종합 감정 지표 생성"]:::rec

    %% 안전 프로토콜
    calib --> riskCheck{실시간 위험도 판단}:::safety
    riskCheck -->|"[실시간 저·중위험 판단]"| followq["꼬리물기 질문 동적 생성<br/>(OpenAI API)"]:::inter
    riskCheck -->|"[실시간 고위험 판단]"| stop[즉시 대화 중단]:::safety

    %% 상호작용 계층
    followq --> tts["TTS<br/>(ElevenLabs API)"]:::inter
    tts --> confirm[응답 확인]:::user
    confirm --> contCheck{대화 지속 여부}
    contCheck -->|"[계속 답변]"| speak
    contCheck -->|"[끝내기]"| fork2[" fork "]:::bar
    stop --> fork2

    %% 기록 계층 (산출물)
    fork2 --> diaryGen[정서 일기 생성]:::rec
    fork2 --> docGen[상담용 문서 생성]:::rec
    diaryGen --> join2[" join "]:::bar
    docGen --> join2
    join2 --> save[DB에 저장]:::rec
    save --> done((◉))

    classDef user fill:#ffffff,stroke:#34495e;
    classDef pre fill:#fdebd0,stroke:#e67e22;
    classDef rec fill:#d5f5e3,stroke:#27ae60;
    classDef safety fill:#fadbd8,stroke:#c0392b;
    classDef inter fill:#e8daef,stroke:#8e44ad;
    classDef bar fill:#34495e,color:#ffffff,stroke:#2c3e50;
```

### 3-2. UC-02 포스트프로세스 — 종합 위험도 평가 및 안전망 연결

```mermaid
flowchart TD
    start((●)) --> integrate[감정 수치 통합]
    integrate --> evaluate["종합 위험도 평가 수행<br/>(사실위험 탐지 모델)"]
    evaluate --> riskLevel{종합 위험도 판단}

    %% 등급별 1차 개입
    riskLevel -->|"[저위험 판단]"| tip[일상 관리 팁 제공]:::low
    riskLevel -->|"[중위험 판단]"| refer[상담서비스 추천]:::mid
    riskLevel -->|"[고위험 판단]"| fork1[" fork "]:::bar
    %% 저·중위험: 사용자 확인 후 fork 우회 → join 으로 합류
    tip --> tipConfirm[일상 관리 팁 확인]:::user
    refer --> referConfirm[상담서비스 추천 확인]:::user
    tipConfirm --> join1
    referConfirm --> join1

    %% 고위험 안전망 (병렬)
    fork1 --> orgTry[전문 심리 상담 기관<br/>연결 시도]:::high
    fork1 --> guardTry[보호자 알림 발송 시도]:::high
    orgTry --> orgCheck{기관 연결 여부}
    orgCheck -->|"[기관 연결 승인]"| callConnect[긴급 전화번호<br/>안내 및 연결]:::high
    orgCheck -->|"[기관 연결 거부]"| guardCheck
    guardTry --> guardCheck{연락처 등록 여부}
    guardCheck -->|"[연락처 등록]"| guardSend[보호자 알림 발송]:::high
    guardCheck -->|"[연락처 미등록]"| join1
    callConnect --> join1[" join "]:::bar
    guardSend --> join1

    %% 사후 처리
    join1 --> monitor[지속 모니터링 필요 판단]:::low
    monitor --> schedule["24시간 후 자동 안부 확인<br/>메시지 발송 스케줄 등록"]
    schedule --> auditLog[이벤트 로그 DB 적재]
    auditLog --> recordReq[지속적 기록 요청]:::low
    recordReq --> homeReturn[일기 확인 및 홈화면 복귀]:::user
    homeReturn --> done((◉))

    classDef user fill:#ffffff,stroke:#34495e;
    classDef low fill:#fdebd0,stroke:#e67e22;
    classDef mid fill:#fadbd8,stroke:#e74c3c;
    classDef high fill:#f1948a,stroke:#c0392b;
    classDef bar fill:#34495e,color:#ffffff,stroke:#2c3e50;
```

### 3-3. UC-03 기록 관리 — 일기 조회/공유/삭제/수정

```mermaid
flowchart TD
    start((●)) --> access[일기 접속]:::user
    access --> existCheck{이전 기록 존재?}
    existCheck -->|"[이전 기록 없음]"| none[기록 없음 확인]:::user
    none --> done2((◉))
    existCheck -->|"[이전 기록 존재]"| query["DB에서 일기 목록<br/>날짜순 조회"]
    query --> listShow[일기 목록 표시]:::list

    listShow --> filterCheck{필터링 조건 선택}
    filterCheck -->|"[나가기]"| done2
    filterCheck -->|"[선택]"| filtered[필터링된 일기 목록 표시]:::list
    filterCheck -->|"[필터링 조건 미선택]"| selectDiary[열람할 일기 선택]:::user
    filtered --> selectDiary
    selectDiary --> detail[선택한 일기 상세 표시]:::list
    detail --> content[일기 내용 확인]:::user

    content --> action{동작 선택}
    action -->|"[일기 목록 복귀]"| listShow
    action -->|"[연결 상담 문서 확인]"| done2
    action -->|"[나가기]"| home[홈화면으로 복귀]:::user
    home --> done3((◉))

    %% 공유 액션 → 완료 후 목록으로 복귀
    action -->|"[공유]"| shareShow[공유 방법 표시]:::share
    shareShow --> shareDo[공유 방법 선택 및 공유]:::share
    shareDo -.->|목록 복귀| listShow

    %% 삭제 액션
    action -->|"[삭제]"| delWarn["삭제 경고<br/>'복구 불가' 안내"]:::del
    delWarn --> delCancel{취소 여부}
    delCancel -->|"[취소]"| content
    delCancel -->|"[삭제]"| delScope{삭제 범위}
    delScope -->|"[연결 상담 문서 동반 삭제]"| docDel[상담 문서 삭제]:::del
    delScope -->|"[일기만 삭제]"| diaryDel[일기 삭제]:::del
    docDel --> diaryDel
    diaryDel --> delLog[삭제 로그 DB 저장]:::del
    delLog --> delDone[삭제 완료 안내]:::del
    delDone -.->|목록 복귀| listShow

    %% 수정 액션
    action -->|"[수정]"| edit[일기 수정]:::user
    edit --> editCancel{수정 취소 여부}
    editCancel -->|"[취소]"| content
    editCancel -->|"[저장]"| editApply[수정 내용 DB 반영]:::edit
    editApply --> editLog[수정 로그 DB 저장]:::edit
    editLog --> editDone2[수정 완료 안내]:::edit
    editDone2 --> editDone((◉))

    classDef user fill:#ffffff,stroke:#34495e;
    classDef list fill:#fdebd0,stroke:#e67e22;
    classDef share fill:#d6eaf8,stroke:#2980b9;
    classDef del fill:#fadbd8,stroke:#c0392b;
    classDef edit fill:#d5f5e3,stroke:#27ae60;
```

---

## 4. 클래스 다이어그램 (Class Diagram)

> 시퀀스 다이어그램(섹션 5)과 동일한 식별자를 사용한다. 실제 코드(`backend/src`)의 도메인 포트
> (`<<interface>>`)와 어댑터 구현(`..|>`)을 구분 표기하며, MVP 활성 구현만 그린다. Phase 2 확장
> (`hume_prosody`/`elevenlabs_tts` 채널, NER 훅, 알림 채널 어댑터, 상담문서 producer)은 `▼P2`로 표기.
>
> **군집화(namespace) — 패키지 단위.** UML 표준대로 클래스를 **실제 소스 패키지(폴더)**로 묶는다.
> 네임스페이스 이름은 `backend/src` 경로 그대로(`domain.<feature>` / `adapters.<feature>` / `transport` /
> `shared`)이며, 의존 방향은 `domain → adapters`가 아니라 **어댑터가 도메인 포트를 구현**(`..|>`)하는
> 의존 역전(헥사고날) 구조다.

### 4-1. UC-01 대화 세션 클래스 다이어그램

```mermaid
classDiagram
    direction LR

    namespace domain.session {
        class SessionOrchestrator {
            +startSession(userId) Promise~SessionContext~
            +handleUtterance(sessionId, input) Promise~HandleUtteranceResult~
            +handleSilenceTimeout(sessionId, phase) Promise~SilenceAction~
            +endSession(sessionId, reason) Promise~EndSessionResult~
        }
        class SessionRepository {
            <<interface>>
            +getSession(sessionId) Promise~SessionContext?~
            +saveSession(ctx) Promise~void~
            +deleteSession(sessionId) Promise~void~
        }
        class ArtifactPipeline {
            <<interface>>
            +generateAndPersist(session, consents) Promise~ProducedArtifact[]~
        }
    }

    namespace domain.ai-gateway {
        class AIGateway {
            <<interface>>
            +setHook(hook) void
            +registerAdapter(target, adapter) void
            +callExternalAI(target, req, ctx) Promise~AIGatewayCallResult~
        }
        class AIGatewayImpl
        class DeidentificationHook {
            <<interface>>
            +hookId: string
            +process(input) Promise~HookProcessResult~
        }
        class ExternalAdapter {
            <<interface>>
            +invoke(processed) Promise~unknown~
        }
    }

    namespace domain.emotion {
        class EmotionAnalyzer {
            +registerChannel(channel) void
            +analyze(input, ctx) Promise~CalibratedEmotion~
        }
        class EmotionChannel {
            <<interface>>
            +channelId: string
            +analyze(input, ctx) Promise~ChannelResult~
            +isAvailable() Promise~boolean~
        }
        class ChannelCalibrator {
            <<interface>>
            +combine(results, policy, opts?) CalibratedEmotion
        }
        class DefaultChannelCalibrator
    }

    namespace domain.dialogue {
        class DialogueEngine {
            <<interface>>
            +generateResponse(input) Promise~DialogueResult~
            +detectEndIntent(text) boolean
            +detectMedicalKeywords(text) boolean
        }
        class DialogueEngineImpl
        class DialogueGenerator {
            <<interface>>
            +generate(input) Promise~DialogueGeneratorOutput~
        }
        class MedicalKeywordDetector {
            <<function>>
            +detectMedicalKeywords(text)
        }
        class StageTransition {
            <<function>>
            +getNextStage(stage, hadExchange, endIntent)
        }
    }

    namespace domain.risk {
        class RiskEvaluator {
            +registerSignal(signal) void
            +evaluateUtterance(input, prev) UtteranceRiskAssessment
            +applyTransition(prev, latest) RiskState
        }
        class RiskSignal {
            <<interface>>
            +signalId: string
            +evaluate(input) RiskLevel
        }
        class KeywordSignal
        class EmotionScoreSignal
        class RiskDecisionFunction {
            <<interface>>
            +decide(perSignal) RiskLevel
        }
    }

    namespace domain.safety {
        class SafetyProtocol {
            +logRiskEvaluation(level, ctx) Promise~boolean~
            +triggerLow/Medium/High(...)
        }
    }

    namespace domain.artifact {
        class ArtifactProducerRegistry {
            +register(producer) void
            +produceAll(session, consents) Promise~ProducedArtifact[]~
        }
        class ArtifactProducer {
            <<interface>>
            +artifactType: string
            +requiresConsent?: string
            +produce(session) Promise~T~
        }
    }

    namespace adapters.stt {
        class STTAdapter {
            <<interface>>
            +transcribe(audio, opts) Promise~TranscriptionResult~
        }
        class WhisperSTTAdapter
    }

    namespace adapters.ai-gateway {
        class PassthroughHook
        class ExternalAdapterFactory {
            <<factory functions>>
            +createGeminiAdapters(client, model)
            +createOpenAiAdapters(client, model)
        }
    }

    namespace adapters.emotion {
        class TextChannel
    }

    namespace adapters.dialogue {
        class Gpt4oDialogueAdapter
    }

    namespace adapters.persistence {
        class RedisSessionRepository
    }

    namespace adapters.artifact {
        class ArtifactPersistencePipeline
        class DiaryProducer
    }

    %% 실현(구현) — 어댑터가 도메인 포트를 구현
    WhisperSTTAdapter ..|> STTAdapter
    AIGatewayImpl ..|> AIGateway
    PassthroughHook ..|> DeidentificationHook
    ExternalAdapterFactory ..> ExternalAdapter : creates 구현 객체
    TextChannel ..|> EmotionChannel
    DefaultChannelCalibrator ..|> ChannelCalibrator
    DialogueEngineImpl ..|> DialogueEngine
    Gpt4oDialogueAdapter ..|> DialogueGenerator
    KeywordSignal ..|> RiskSignal
    EmotionScoreSignal ..|> RiskSignal
    RedisSessionRepository ..|> SessionRepository
    ArtifactPersistencePipeline ..|> ArtifactPipeline
    DiaryProducer ..|> ArtifactProducer

    %% 합성/의존
    AIGatewayImpl o-- DeidentificationHook : 정확히 1회 적용
    AIGatewayImpl o-- ExternalAdapter : target별 라우팅
    EmotionAnalyzer o-- EmotionChannel : registers *
    EmotionAnalyzer --> ChannelCalibrator
    DialogueEngineImpl o-- DialogueGenerator
    DialogueEngineImpl ..> MedicalKeywordDetector
    DialogueEngineImpl ..> StageTransition
    RiskEvaluator o-- RiskSignal : registers *
    RiskEvaluator --> RiskDecisionFunction : 최댓값 정책
    ArtifactPersistencePipeline o-- ArtifactProducerRegistry
    ArtifactProducerRegistry o-- ArtifactProducer : registers *
    WhisperSTTAdapter ..> AIGateway : 'whisper_stt'
    TextChannel ..> AIGateway : 'gpt4o_emotion'
    Gpt4oDialogueAdapter ..> AIGateway : 'gpt4o_dialogue'
    DiaryProducer ..> AIGateway : 'gpt4o_diary'

    %% 오케스트레이터 포트 주입
    SessionOrchestrator --> STTAdapter
    SessionOrchestrator --> EmotionAnalyzer
    SessionOrchestrator --> DialogueEngine
    SessionOrchestrator --> RiskEvaluator
    SessionOrchestrator --> SafetyProtocol
    SessionOrchestrator --> SessionRepository
    SessionOrchestrator --> ArtifactPipeline

    note for ExternalAdapterFactory "클래스 아님 — 팩토리 함수가 ExternalAdapter 구현 객체 반환(provider 교체식)"
```

### 4-2. UC-02 안전망 클래스 다이어그램

```mermaid
classDiagram
    direction LR

    namespace domain.session {
        class SessionOrchestrator {
            +endSession(sessionId, reason) Promise~EndSessionResult~
        }
    }

    namespace domain.risk {
        class RiskEvaluator {
            +evaluateUtterance(input, prev) UtteranceRiskAssessment
            +applyTransition(prev, latest) RiskState
        }
        class RiskState {
            +current: RiskLevel
            +consecutiveLowerCount: number
            +highRiskTriggered: boolean
            +perSignal: RiskSignalSnapshot[]
        }
    }

    namespace domain.safety {
        class SafetyProtocol {
            -auditLogger: SafetyAuditLogger
            -notificationRegistry: NotificationChannelRegistry
            +triggerLow(scores, ctx, tipCount=3) Promise~LowRiskResult~
            +triggerMedium(ctx) Promise~MediumRiskResult~
            +triggerHigh(ctx) Promise~HighRiskResult~
            +logRiskEvaluation(level, ctx) Promise~boolean~
            +logHighRiskAbnormalEnd(ctx, reason) Promise~boolean~
        }
        class SafetyTriggerContext {
            +sessionId: string
            +userId: string
            +triggeredSignals?: Signal[]
        }
        class LowRiskResult {
            +level = "저위험"
            +topEmotion: EmotionCategory
            +tips: DailyTip[]
        }
        class MediumRiskResult {
            +level = "중위험"
            +referrals: CounselingReferral[]
            +recommendation: string
        }
        class HighRiskResult {
            +level = "고위험"
            +emergencyContactsDisplayed = ['1393','1577-0199']
            +warningMessage: string
            +sessionForcedToFinalize = true
            +externalNotificationsSent: number
        }
    }

    namespace domain.notification {
        class NotificationChannelRegistry {
            -adapters: Map~string, NotificationChannelAdapter~
            +register(adapter) void
            +getById(id) NotificationChannelAdapter?
            +list() NotificationChannelAdapter[]
        }
    }

    namespace adapters.persistence {
        class SafetyAuditLogger {
            <<interface>>
            +logEvent(event: SafetyAuditEvent) Promise~void~
        }
        class PgSafetyAuditLogger
        class InMemorySafetyAuditLogger
        class SafetyAuditEvent {
            +sessionId: string
            +userId: string
            +eventType: SafetyAuditEventType
            +riskLevel?: RiskLevel
            +payload: SafetyAuditPayload
        }
    }

    namespace adapters.notification {
        class NotificationChannelAdapter {
            <<interface>>
            +channelId: string
            +send(payload) Promise~NotificationResult~
            +schedule(payload, atTime) Promise~ScheduleHandle~
        }
        class NotificationPayload {
            +userId: string
            +guardianId?: string
            +templateId: string
            +vars: Map
        }
        class NotificationResult {
            +channelId: string
            +status: success|failed
            +attempts: number
            +errorCode?: string
        }
        class ScheduleHandle {
            +scheduleId: string
            +scheduledFor: Date
            +cancel() Promise~void~
        }
    }

    namespace shared {
        class SafetyContent {
            <<module @nadaum/shared>>
            +EMERGENCY_PHONE_NUMBERS
            +COUNSELING_REFERRALS
            +tipsForEmotion(emotion, n, rng)
        }
        class DailyTip {
            +id: string
            +category: EmotionCategory
            +text: string
        }
        class CounselingReferral {
            +id: string
            +name: string
            +phone: string
        }
    }

    %% 실체화: 어댑터가 포트 구현
    PgSafetyAuditLogger ..|> SafetyAuditLogger
    InMemorySafetyAuditLogger ..|> SafetyAuditLogger

    %% 연관: 필드로 보유 (다중도는 대상 끝에)
    SessionOrchestrator --> "1" SafetyProtocol : safety
    SafetyProtocol --> "1" SafetyAuditLogger : auditLogger
    SafetyProtocol --> "1" NotificationChannelRegistry : notificationRegistry

    %% 집합: 컬렉션 보유 (다이아몬드=소유 쪽, 다중도=부분 쪽)
    NotificationChannelRegistry o-- "0..*" NotificationChannelAdapter : adapters
    LowRiskResult o-- "1..3" DailyTip : tips
    MediumRiskResult o-- "1..*" CounselingReferral : referrals

    %% 의존: 생성/사용
    SafetyProtocol ..> LowRiskResult : «create»
    SafetyProtocol ..> MediumRiskResult : «create»
    SafetyProtocol ..> HighRiskResult : «create»
    SafetyProtocol ..> SafetyTriggerContext : «use»
    SafetyProtocol ..> SafetyContent : «use»
    RiskEvaluator ..> RiskState : «create»
    SessionOrchestrator ..> RiskState : «use»
    NotificationChannelAdapter ..> NotificationPayload : «use»
    NotificationChannelAdapter ..> NotificationResult : «create»
    NotificationChannelAdapter ..> ScheduleHandle : «create»
    SafetyAuditLogger ..> SafetyAuditEvent : «use»

    note for NotificationChannelRegistry "MVP: 어댑터 0개 → list()=[] → 외부 알림 0회 (요구사항 14.2)"
    note for NotificationChannelAdapter "▼P2: Sms/Push/Email/AgencyApi/WelfareCheck24h 어댑터"
```

### 4-3. UC-03 기록 관리 클래스 다이어그램

```mermaid
classDiagram
    direction LR

    namespace transport {
        class TransportApp {
            <<Express createApp>>
            +GET /diaries
            +GET /diaries/:id
            +PATCH /diaries/:id
            +DELETE /diaries/:id
        }
    }

    namespace domain.query {
        class DiaryQueryService {
            -diaries: DiaryRepository
            +list(userId, page=0) Promise~DiaryListPage~
            +getById(userId, diaryId) Promise~DiaryEntry?~
            +updateBody(userId, diaryId, body) Promise~DiaryEntry?~
            +deleteById(userId, diaryId) Promise~boolean~
        }
        class DiaryListPage {
            +items: DiaryEntry[]
            +page: number
            +hasNext: boolean
        }
    }

    namespace domain.diary {
        class DiaryRepository {
            <<interface>>
            +insert(diary, tx?) Promise~void~
            +findById(userId, diaryId) Promise~DiaryEntry?~
            +listByUser(userId, page) Promise~DiaryEntry[]~
            +updateBody(userId, diaryId, body) Promise~DiaryEntry?~
            +delete(userId, diaryId) Promise~boolean~
        }
        class ArtifactRepository {
            <<interface>>
            +insert(meta, tx?) Promise~void~
            +findById(artifactId) Promise~ArtifactMeta?~
        }
        class ArtifactMeta {
            +artifactId: string
            +artifactType: string
            +payloadRef: string
            +accessPolicy: AccessPolicy
        }
        class DiaryPageQuery {
            +limit: number
            +offset: number
        }
        class DiaryAuditLogger {
            <<interface ▼P2>>
            +logEdit(userId, diaryId) Promise~void~
            +logDelete(userId, diaryId, cascade) Promise~void~
        }
        class DiaryAuditEntry {
            +diaryId: string
            +userId: string
            +action: edit|delete
            +at: Date
        }
    }

    namespace adapters.persistence {
        class PgDiaryRepository
        class PgArtifactRepository
        class PgDiaryAuditLogger
    }

    namespace shared {
        class DiaryEntry {
            +diaryId: string
            +userId: string
            +sessionId: string
            +sessionDate: string
            +title: string
            +tags: string[]
            +bodyType: full|brief
            +body: string
            +emotionScores: EmotionScores
        }
        class EmotionScores {
            +기쁨: int
            +슬픔: int
            +분노: int
            +불안: int
            +놀람: int
            +혐오: int
            +중립: int
        }
        class AccessPolicy {
            +owner: user|system
            +share: string[]
        }
    }

    %% 실체화: 어댑터가 포트 구현
    PgDiaryRepository ..|> DiaryRepository
    PgArtifactRepository ..|> ArtifactRepository
    PgDiaryAuditLogger ..|> DiaryAuditLogger

    %% 연관: 호출/보유 (다중도는 대상 끝에)
    TransportApp --> "1" DiaryQueryService : diaries
    DiaryQueryService --> "1" DiaryRepository : diaries

    %% 집합: 목록이 항목 보유 (다이아몬드=소유 쪽)
    DiaryListPage o-- "0..*" DiaryEntry : items

    %% 연관: 필드(값 타입)
    DiaryEntry --> "1" EmotionScores : emotionScores
    ArtifactMeta --> "1" AccessPolicy : accessPolicy

    %% 의존: 생성/사용
    DiaryQueryService ..> DiaryListPage : «create»
    DiaryRepository ..> DiaryEntry : «use»
    DiaryRepository ..> DiaryPageQuery : «use»
    ArtifactRepository ..> ArtifactMeta : «use»
    DiaryQueryService ..> ArtifactRepository : share/cascade-delete (P2)

    %% 수정/삭제 로그 (▼P2 — 활동도의 "수정 로그/삭제 로그 DB 저장")
    DiaryQueryService ..> DiaryAuditLogger : audit (P2)
    DiaryAuditLogger ..> DiaryAuditEntry : «create»

    note for DiaryQueryService "모든 read는 userId로 사용자 격리 · list 페이지 10개(hasNext용 +1 조회)"
    note for ArtifactRepository "▼P2: 일기 공유(recipients/accessPolicy)·연결 상담문서 동반 삭제"
    note for DiaryAuditLogger "▼P2 미구현 — 일기 수정/삭제 변경 이력 기록 (활동도 반영)"
```

---

## 5. 시퀀스 다이어그램 (Sequence Diagram)

> **구현 기반 작성 원칙.** 본 3개 시퀀스는 실제 백엔드 코드(`backend/src`)의 클래스·메서드
> 시그니처를 그대로 사용한다. 외부 AI 타겟은 `whisper_stt` · `gpt4o_emotion` · `gpt4o_dialogue` ·
> `gpt4o_diary`이며, 비식별화 훅은 MVP 기준 `PassthroughHook`(무변형)이다.
>
> **외부 AI provider(교체식).** `AIGateway`에 등록되는 `ExternalAdapter` 구현이 환경변수로 결정된다
> ([composeBackend.ts](../backend/src/boot/composeBackend.ts)): LLM(감정·대화·일기)은 `GEMINI_API_KEY`
> 우선 → **Gemini 2.5 Flash**, 아니면 `OPENAI_API_KEY` → **GPT-4o**. STT는 **OpenAI Whisper**.
> (테스트용 fake 어댑터 경로는 본 문서에서 생략한다.)
>
> **가독성을 위한 의도적 병합.** 실제 호출 경로에는 어댑터 1홉이 더 있으나 라이프라인을 병합했다:
> `EmotionAnalyzer → TextChannel → AIGateway`, `DialogueEngine → Gpt4oDialogueAdapter → AIGateway`,
> 그리고 `AIGateway → ExternalAdapter.invoke() → 외부 API`. 각 도메인 서비스 라이프라인의 부제로 병합
> 대상을 표기한다.
>
> **미구현(Phase 2)** 구간은 `▼ Phase 2`로 표기한다: `hume_prosody`·`elevenlabs_tts` 타겟,
> `KlueKoelectraNerHook`(현재 PassthroughHook), `NotificationChannelAdapter`(알림 채널 0개 등록),
> 상담용 문서 산출물, 일기 공유, 실시간 이벤트 publish 배선. 클래스 다이어그램(섹션 4)과 동일한
> 식별자를 사용하여 통일성을 유지한다.

### 5-1. UC-01 대화 세션 — 발화 처리 파이프라인 + 세션 종료

```mermaid
sequenceDiagram
    autonumber
    actor User as 사용자(내담자)
    participant FE as ": Frontend<br/>(React)"
    participant API as ": Transport<br/>(Express·requireAuth)"
    participant SO as ": SessionOrchestrator"
    participant Redis as ": SessionRepository<br/>(Redis)"
    participant STT as ": WhisperSTTAdapter"
    participant GW as ": AIGateway<br/>+PassthroughHook"
    participant EA as ": EmotionAnalyzer<br/>(TextChannel·Calibrator)"
    participant DE as ": DialogueEngine<br/>(Gpt4oDialogueAdapter)"
    participant RE as ": RiskEvaluator"
    participant SP as ": SafetyProtocol"
    participant AP as ": ArtifactPersistencePipeline<br/>(Registry·DiaryProducer)"
    participant Ext as ": 외부 AI<br/>(Whisper STT · Gemini 2.5 Flash/GPT-4o)"
    participant DB as ": PostgreSQL"

    Note over User,DB: 세션 시작 (동의 완료·로그인 상태). 실시간 구독 채널 WS/SSE(SessionEventHub.subscribe)는 구현, 단 이벤트 publish 배선은 ▼P2.
    User->>FE: 대화하기 접속
    FE->>API: POST /sessions
    API->>SO: start(userId)
    SO->>Redis: saveSession(초기 SessionContext)
    SO-->>API: SessionContext{stage:'상황파악'}
    API-->>FE: 201 {sessionId}

    loop 발화마다 handleUtterance(sessionId, input)
        User->>FE: 음성 발화 (또는 텍스트 직접 입력)
        FE->>API: POST /sessions/{id}/utterances {audioBase64|text}
        Note over API: requireAuth로 userId 인증 후 SessionApi 어댑터가 userId 분리
        API->>SO: handleUtterance(sessionId, input)
        SO->>Redis: getSession(sessionId)
        Redis-->>SO: SessionContext

        alt 오디오 입력
            SO->>STT: transcribe(audio,{maxDurationSec:120,language:'ko'})
            STT->>GW: callExternalAI('whisper_stt',{audio,language})
            GW->>GW: hook.process() [PassthroughHook]
            GW->>Ext: ExternalAdapter.invoke() — OpenAI Whisper STT (최대 3회·10s)
            Ext-->>GW: {text, durationSec}
            GW-->>STT: AIGatewayCallResult
            STT-->>SO: {ok:true,text} 또는 {ok:false, silence|invalid_audio|service_error}
            Note over SO,FE: 실패 시 stt_* 반환 → 재시도 안내 / 텍스트 직접 입력 대안
        end

        par 감정 분석 ∥ 대화 응답 (Promise.all)
            SO->>EA: analyze({text},{sessionId,userId})
            EA->>GW: callExternalAI('gpt4o_emotion', prompt)
            GW->>GW: hook.process() [PassthroughHook]
            GW->>Ext: ExternalAdapter.invoke() — LLM 감정 분석
            Ext-->>GW: 7감정 1~10 점수 + 인지왜곡(JSON)
            GW-->>EA: 응답
            EA->>EA: ChannelCalibrator.combine('text_only')
            EA-->>SO: CalibratedEmotion{combinedScores}
        and
            SO->>DE: generateResponse({userText, sessionContext, latestEmotion})
            DE->>DE: detectEndIntent / detectMedicalKeywords
            DE->>GW: callExternalAI('gpt4o_dialogue', systemPrompt+prompt)
            GW->>Ext: ExternalAdapter.invoke() — LLM 공감 응답
            Ext-->>GW: AI 응답 텍스트
            GW-->>DE: 응답
            DE->>DE: getNextStage(5단계 전이)
            DE-->>SO: {aiResponse, nextStage, isMedicalRedirect}
        end
        Note over SO: 대화 생성 전부 실패 시 보수적 폴백 응답 + 단계 보존(dialogueDegraded)

        SO->>SO: addExchange(user/ai 이력, FIFO 50) + appendUtteranceResult(감정 누적)
        SO->>RE: evaluateUtterance({text, emotionScores}, riskState)
        RE->>RE: KeywordSignal·EmotionScoreSignal → decide(최댓값) → applyTransition(비대칭)
        RE-->>SO: {latest.combinedLevel, nextState}
        SO->>SP: logRiskEvaluation(level, ctx)
        SP->>DB: safety_audit_log INSERT (event:'risk_evaluated')
        SP-->>SO: auditLogged
        SO->>Redis: saveSession(감정·위험·단계·이력 갱신)
        SO-->>API: {transcript, aiResponse, riskLevel, stage, forceFinalize}
        API-->>FE: 200 HandleUtteranceResult

        alt forceFinalize == true (고위험)
            Note over FE,SP: 즉시 endSession('high_risk') — 안전 개입은 UC-02 시퀀스
        end
    end

    Note over User,DB: 종료 의사 / 침묵 60+60s 타임아웃 → endSession(reason)
    User->>FE: 종료 의사 표현
    FE->>API: POST /sessions/{id}/end {reason:'user'}
    API->>SO: endSession(sessionId, reason)
    SO->>Redis: getSession(sessionId)
    Redis-->>SO: SessionContext
    Note over SO,SP: 최종 위험도별 안전 개입(저/중/고) → UC-02 시퀀스 참조

    SO->>AP: generateAndPersist(SessionResult, consents)
    AP->>AP: ArtifactProducerRegistry.produceAll (동의 게이트 requiresConsent)
    AP->>GW: DiaryProducer.produce → callExternalAI('gpt4o_diary', prompt)
    GW->>Ext: ExternalAdapter.invoke() — LLM 일기 생성 (≤30s, 최대 3회)
    Ext-->>GW: 일기 원문
    GW-->>AP: 응답
    AP->>AP: sanitize(본문) + 발화≥3 ? full(200~1000자) : brief
    AP->>DB: diaries.insert + artifactRepo.insert (단일 트랜잭션)
    AP-->>SO: ProducedArtifact[]
    SO->>Redis: deleteSession(sessionId)
    SO-->>API: {reason, finalRiskLevel, artifacts}
    API-->>FE: 200 {정서 일기 + 감정 요약}
    Note over AP,DB: ▼ Phase 2 — 상담용 문서 산출물(artifactType≠'emotion_diary')은 영속화 보류
```

### 5-2. UC-02 포스트프로세스 — 종합 위험도 평가 및 안전망 연결

```mermaid
sequenceDiagram
    autonumber
    participant FE as ": Frontend<br/>(React)"
    participant SO as ": SessionOrchestrator"
    participant Redis as ": SessionRepository<br/>(Redis)"
    participant SP as ": SafetyProtocol"
    participant NReg as ": NotificationChannelRegistry"
    participant DB as ": PostgreSQL<br/>(safety_audit_log)"
    participant NAdp as ": NotificationChannelAdapter ▼P2"
    participant Sched as ": Scheduler ▼P2"

    Note over SO,DB: 진입 — endSession(reason): 발화 루프 종료 / 고위험 forceFinalize
    SO->>Redis: getSession(sessionId)
    Redis-->>SO: SessionContext
    Note over SO: 감정 수치 통합 = cumulativeEmotion.aggregate · 종합 위험도 = riskState.current

    alt finalRiskLevel == 저위험
        SO->>SP: triggerLow(aggregateScores, ctx)
        SP->>SP: highestEmotionCategory → tipsForEmotion(1~3개)
        SP->>DB: logEvent('low_intervention', 저위험)
        SP-->>SO: LowRiskResult{tips, auditLogged}
        SO-->>FE: 일상 관리 팁 1~3개
    else finalRiskLevel == 중위험
        SO->>SP: triggerMedium(ctx)
        SP->>DB: logEvent('medium_intervention', 중위험)
        SP-->>SO: MediumRiskResult{referrals(COUNSELING_REFERRALS), recommendation}
        SO-->>FE: 상담 서비스 추천 + 기관 연락처 안내
    else finalRiskLevel == 고위험 (또는 reason=='high_risk')
        opt 비정상 종료(silence/error)
            SO->>SP: logHighRiskAbnormalEnd(ctx, reason)
            SP->>DB: logEvent('high_intervention_abnormal_end', 고위험)
        end
        SO->>SP: triggerHigh(ctx)
        SP->>NReg: list()
        NReg-->>SP: [] (MVP: 등록 채널 0개)
        Note over SP,NReg: MVP 외부 알림 0회 발송 — 화면 개입만 (요구사항 14.2)
        SP->>DB: logEvent('high_intervention', 고위험)
        SP-->>SO: HighRiskResult{emergencyContactsDisplayed:['1393','1577-0199'],<br/>warningMessage, sessionForcedToFinalize:true, externalNotificationsSent:0}
        SO-->>FE: 긴급 연락처 고정 + 강한 경고 + 세션 강제 마무리
    end

    Note over NReg,Sched: ▼ Phase 2 — NotificationChannelAdapter 등록 시 안전망 자동 연결
    opt Phase 2: 전문 기관 연결 / 보호자 알림 / 모니터링
        SP->>NReg: getById('counseling' | 'guardian')
        NReg-->>SP: NotificationChannelAdapter
        SP->>NAdp: send(payload) — 전문 기관 연결·보호자 알림 발송
        NAdp-->>SP: NotificationResult
        SP->>Sched: schedule(payload, +24h) — 자동 안부 확인
    end

    SO->>Redis: deleteSession(sessionId)
    Note over SO,DB: 정서 일기 생성·영속화는 UC-01 endSession 후미 참조
```

### 5-3. UC-03 기록 관리 — 일기 목록/상세/수정/삭제/공유

```mermaid
sequenceDiagram
    autonumber
    actor User as 사용자(내담자)
    participant FE as ": Frontend<br/>(React)"
    participant API as ": Transport<br/>(Express·requireAuth)"
    participant DQ as ": DiaryQueryService"
    participant DRepo as ": DiaryRepository"
    participant DB as ": PostgreSQL<br/>(diary_entries)"
    participant ARepo as ": ArtifactRepository ▼P2"

    Note over User,DB: 모든 요청 JWT 인증(requireAuth → getUserId). read는 userId로 사용자 격리.

    User->>FE: 일기 접속
    FE->>API: GET /diaries?page=0
    API->>DQ: list(userId, page)
    DQ->>DRepo: listByUser(userId,{limit:11, offset})
    DRepo->>DB: SELECT … WHERE user_id ORDER BY session_date DESC LIMIT 11
    DB-->>DRepo: rows
    DRepo-->>DQ: DiaryEntry[]
    DQ-->>API: DiaryListPage{items(≤10), page, hasNext}
    API-->>FE: 200 일기 목록
    FE-->>User: 일기 목록 표시

    User->>FE: 열람할 일기 선택
    FE->>API: GET /diaries/{id}
    API->>DQ: getById(userId, id)
    DQ->>DRepo: findById(userId, id)
    DRepo->>DB: SELECT WHERE diary_id AND user_id
    DB-->>DRepo: row 또는 ∅
    DRepo-->>DQ: DiaryEntry | undefined
    alt 소유 일기 존재
        DQ-->>API: DiaryEntry
        API-->>FE: 200 상세
        FE-->>User: 일기 상세 표시
    else 없음/타 사용자
        DQ-->>API: undefined
        API-->>FE: 404 not_found
        FE-->>User: '일기를 찾을 수 없음' 안내
    end

    alt [수정]
        User->>FE: 본문 수정 후 저장
        FE->>API: PATCH /diaries/{id} {body}
        API->>API: 본문 공백 검증
        API->>DQ: updateBody(userId, id, body)
        DQ->>DQ: 빈 본문 재검증 (빈 값이면 undefined 반환)
        DQ->>DRepo: updateBody(userId, id, body)
        DRepo->>DB: UPDATE … WHERE user_id
        DB-->>DRepo: 갱신 행 또는 ∅
        DRepo-->>DQ: DiaryEntry | undefined
        DQ-->>API: 결과
        API-->>FE: 200 갱신 / 404
    else [삭제]
        User->>FE: 삭제 확인('복구 불가' 안내)
        FE->>API: DELETE /diaries/{id}
        API->>DQ: deleteById(userId, id)
        DQ->>DRepo: delete(userId, id)
        DRepo->>DB: DELETE WHERE diary_id AND user_id
        DB-->>DRepo: affected
        DRepo-->>DQ: boolean
        DQ-->>API: ok
        API-->>FE: 204 / 404
        Note over DRepo,ARepo: ▼ Phase 2 — 연결 상담 문서 동반 삭제(artifacts·payload_ref 연쇄)
    else [공유] ▼ Phase 2 (미구현)
        Note over FE,ARepo: 공유는 ArtifactRepository.recipients/accessPolicy 기반
        FE->>API: (P2) POST /diaries/{id}/share {recipients}
        API->>ARepo: 공유 메타 갱신(accessPolicy, recipients)
        ARepo->>DB: UPDATE artifacts
    end
```

### 시퀀스 다이어그램 핵심 포인트

| UC | 진입점(REST) | 핵심 메서드 체인 | 시간/정책 제약 |
|----|-------------|-----------------|---------------|
| UC-01 | `POST /sessions/:id/utterances` | `handleUtterance` → STT → (감정∥대화) → `evaluateUtterance` → `logRiskEvaluation` → `saveSession` | STT 5s · 응답 10s · 일기 30s |
| UC-01 종료 | `POST /sessions/:id/end` | `endSession` → 안전개입 → `generateAndPersist` → `deleteSession` | 발화≥3 full(200~1000자) |
| UC-02 | (endSession 내부) | `triggerLow/Medium/High` + `logEvent` + (P2)`NotificationChannelAdapter.send` | MVP 외부 알림 0회 |
| UC-03 | `GET/PATCH/DELETE /diaries` | `list/getById/updateBody/deleteById` → `DiaryRepository` | 페이지 10개 · userId 격리 |

---

## 다이어그램 간 일관성 검증

| 검증 항목 | 유스케이스 다이어그램 | 유스케이스 명세서 | 액티비티 다이어그램 | 클래스 다이어그램 | 시퀀스 다이어그램 |
|----------|:---:|:---:|:---:|:---:|:---:|
| 음성-텍스트 변환 | UC-01·STT 변환 | 정상흐름 4 | UC01·STT 노드 | `WhisperSTTAdapter` | 5-1 `transcribe` |
| 감정 분석 | UC-01·멀티모달 분석 | 정상흐름 5 | UC01·캘리브레이션 | `EmotionAnalyzer`·`TextChannel` | 5-1 `analyze` |
| 공감형 대화 | UC-01·꼬리물기 질문 | 정상흐름 6 | UC01·꼬리물기 생성 | `DialogueEngine`·`Gpt4oDialogueAdapter` | 5-1 `generateResponse` |
| 위험도 평가 | UC-01·실시간 위기 감지 | 정상흐름 7 | UC01·위험도 판단 | `RiskEvaluator` | 5-1 `evaluateUtterance` |
| 안전망(저/중/고) | UC-C2·안전망 연결 | 대안흐름 A1·A2 | UC02·등급 분기 | `SafetyProtocol` | 5-2 `triggerLow/Medium/High` |
| 정서 일기 생성 | UC-01·일기 생성 | 정상흐름 10 | UC01·정서 일기 생성 | `DiaryProducer`·`ArtifactPersistencePipeline` | 5-1 `generateAndPersist` |
| 기록 관리 | UC-C3·일기/문서 관리 | — | UC03 전체 | `DiaryQueryService`·`DiaryRepository` | 5-3 `list/getById/updateBody/deleteById` |
| 비의료 경계 | UC-01(대화 내 분기) | 대안흐름 A4 | (대화 내 분기) | `MedicalKeywordDetector` | 5-1 `detectMedicalKeywords` |

> 모든 다이어그램이 동일한 기능 요소를 서로 다른 관점(정적/동적/기능)에서 일관되게 표현하고 있음을 확인할 수 있다.
> (클래스 다이어그램 열은 섹션 4를 UC별 3종으로 재작성하면 동일 식별자로 자동 정합된다.)
