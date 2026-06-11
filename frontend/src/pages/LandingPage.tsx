// 토스 스타일 소개(랜딩) 페이지
import { Icon } from '../components/Icon';
import { LogoImg } from '../components/LogoImg';
import { WaveOrb } from '../components/WaveOrb';
import { SAMPLE_DIARY, SAMPLE_CONVO } from '../data/sampleDiary';

type GoFn = (r: string) => void;

function RecordVisual() {
  return (
    <div className="lp-records">
      {SAMPLE_DIARY.slice(0, 3).map((d) => (
        <div className="rec-card" key={d.id}>
          <div className="rec-date">
            <span>{d.date} · {d.weekday}</span>
            <span style={{ fontSize: 17 }}>{d.mood}</span>
          </div>
          <div className="rec-title">{d.title}</div>
          <div className="rec-ex">{d.excerpt}</div>
          <div className="rec-tags">{d.tags.map((t) => <span key={t}>#{t}</span>)}</div>
        </div>
      ))}
    </div>
  );
}

function BareChat() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 480 }}>
      {SAMPLE_CONVO.map((m, i) => (
        <div
          key={i}
          className="msg-row"
          style={{ alignItems: m.from === 'me' ? 'flex-end' : 'flex-start' }}
        >
          <div className={`bubble ${m.from === 'me' ? 'bubble-me' : 'bubble-ai'}`}>
            {m.text}
          </div>
        </div>
      ))}
    </div>
  );
}

interface LeftItem { text: string; cls: 'ai' | 'me'; top: string; dy: string; delay: string; dur: string }
interface RightItem { title: string; date: string; top: string; delay: string; dur: string }

const LEFT_ITEMS: LeftItem[] = [
  { text: '오늘 퇴근길에 비가 막 그쳤어.',     cls: 'me', top: '3%',  dy: '47cqh',  delay: '0.0s', dur: '6.2s' },
  { text: '발표 끝나고 다리가 풀렸어',         cls: 'me', top: '8%',  dy: '42cqh',  delay: '1.0s', dur: '7.8s' },
  { text: '친구한테 서운했는데 말 못 했어',    cls: 'me', top: '18%', dy: '32cqh',  delay: '2.0s', dur: '5.4s' },
  { text: '오늘 이상하게 눈물이 났어',         cls: 'me', top: '30%', dy: '20cqh',  delay: '3.0s', dur: '8.1s' },
  { text: '엄마 목소리가 갑자기 듣고 싶었어',  cls: 'me', top: '43%', dy: '7cqh',   delay: '4.0s', dur: '7.3s' },
  { text: '오늘 되게 긴 하루였어',             cls: 'me', top: '54%', dy: '-4cqh',  delay: '5.0s', dur: '5.2s' },
  { text: '아무것도 하기 싫은데 쉬지도 못해',  cls: 'me', top: '64%', dy: '-14cqh', delay: '6.0s', dur: '7.6s' },
  { text: '자꾸 예전 생각이 나',              cls: 'me', top: '74%', dy: '-24cqh', delay: '7.0s', dur: '8.4s' },
  { text: '오늘 골목 가로등이 너무 예뻤어',    cls: 'me', top: '73%', dy: '-23cqh', delay: '8.0s', dur: '5.7s' },
];

const RIGHT_ITEMS: RightItem[] = [
  { title: '비 그친 뒤의 골목',        date: '5월 30일 🌤️', top: '50%', delay: '0.0s', dur: '8.5s' },
  { title: '드디어, 그 발표를 끝냈다',  date: '5월 28일 🔥',  top: '50%', delay: '2.8s', dur: '8.5s' },
  { title: '오랜만에 엄마와 통화',      date: '5월 26일 🌙',  top: '50%', delay: '5.7s', dur: '8.5s' },
];

function HeroFlow() {
  return (
    <div className="hf-stage">

      <div className="hf-left-zone">
        {LEFT_ITEMS.map((item, i) => (
          <div
            key={i}
            className="hf-left-item"
            style={{
              top: item.top,
              ['--dy' as string]: item.dy,
              animation: `floatIn ${item.dur} cubic-bezier(0.4,0,1,1) ${item.delay} infinite normal backwards`,
            }}
          >
            <div className={`hf-bubble${item.cls === 'me' ? ' me' : ''}`}>
              {item.text}
            </div>
          </div>
        ))}
      </div>

      <div className="hf-stage-orb">
        <WaveOrb size={110} active />
        <div className="hf-orb-label">나,다움</div>
      </div>

      <div className="hf-right-zone">
        {RIGHT_ITEMS.map((item, i) => (
          <div
            key={i}
            className="hf-right-item"
            style={{ top: item.top, animation: `floatOut ${item.dur} cubic-bezier(0.4,0,0.2,1) ${item.delay} infinite normal backwards` }}
          >
            <div className="hf-diary-mini">
              <div className="hf-diary-mini-date">{item.date}</div>
              <div className="hf-diary-mini-title">{item.title}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MaskCard() {
  return (
    <div className="mask-card">
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)' }}>온디바이스 비식별화</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: '#191f28', letterSpacing: '-0.03em', margin: '8px 0 18px', lineHeight: 1.4 }}>
        민감한 정보는 기기 안에서<br />먼저 가려집니다
      </div>
      {[
        '이름 · 연락처 비식별화',
        '장소 · 기관명 마스킹',
        '외부 전송 전 암호화',
      ].map((label, i) => (
        <div className="mask-row" key={i} style={i === 2 ? { borderBottom: 'none' } : {}}>
          <span className="x"><Icon.check /></span>
          {label}
        </div>
      ))}
      <div className="mask-badge"><Icon.shield width={16} height={16} /> 안전하게 보호되고 있어요</div>
    </div>
  );
}

const FEATURES = [
  { ic: 'mic' as const, c: '#1faa6a', t: '음성 대화형 인터페이스', d: '글쓰기의 부담은 내려놓으세요. 말하듯 편하게 이야기하면, 꼬리에 꼬리를 무는 질문으로 마음을 자연스럽게 환기시켜요.' },
  { ic: 'shield' as const, c: '#3b82f6', t: '온디바이스 개인정보 마스킹', d: '이름·장소 같은 민감한 정보는 기기 안에서 먼저 가려집니다. 가장 내밀한 이야기도 안심하고 털어놓으세요.' },
  { ic: 'bridge' as const, c: '#7c6cff', t: '상담으로 잇는 브릿지', d: '하나의 대화로 나를 위한 일기와 상담사를 위한 자료를 동시에. 필요할 땐 전문가에게 안전하게 연결돼요.' },
  { ic: 'book' as const, c: '#e0a020', t: '정서 일기 자동 생성', d: '거친 표현은 부드럽게, 흩어진 감정은 하나의 이야기로. 거부감 없이 다시 읽는 나의 하루를 남겨요.' },
];

export function LandingPage({ go }: { go: GoFn }) {
  return (
    <div className="lp-page fade-in">
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <button
            className="lp-brand"
            onClick={() => document.querySelector('.lp')?.scrollTo({ top: 0, behavior: 'smooth' })}
            title="맨 위로"
            aria-label="맨 위로"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            <span className="lg"><LogoImg height={39} /></span>
          </button>
          <div className="lp-nav-actions">
            <button className="tbtn tbtn-soft tbtn-sm" onClick={() => go('signup')}>회원가입</button>
            <button className="tbtn tbtn-primary tbtn-sm" onClick={() => go('login')}>로그인</button>
          </div>
        </div>
      </nav>

      <div className="lp">
      <section className="lp-sec lp-hero" id="sec-hero">
        <div className="inner">
          <h1>하루의 모든 감정,<br />말하면 일기가 됩니다</h1>
          <p>빈 노트를 채울 필요 없어요. 편하게 말로 들려주면, 나,다움이 한 편의 따뜻한 일기로 정리해드려요.</p>
          <div className="lp-cta">
            <button className="tbtn tbtn-primary" onClick={() => go('login')}>시작하기</button>
          </div>
          <div style={{ marginTop: 'clamp(20px, 3vh, 36px)', width: '100%' }}>
            <HeroFlow />
          </div>
        </div>
      </section>

      <section className="lp-sec alt" id="sec-record">
        <div className="inner lp-row">
          <div className="lp-copy">
            <div className="lp-eyebrow">기록</div>
            <h2>내 마음 관리,<br />대화부터 일기까지<br />똑똑하게</h2>
            <p>오늘 있었던 일을 말하기만 하면 돼요. 흩어진 감정이 한 편의 일기로 쌓이고, 지난 하루를 언제든 다시 펼쳐볼 수 있어요.</p>
          </div>
          <div className="lp-visual"><RecordVisual /></div>
        </div>
      </section>

      <section className="lp-sec" id="sec-talk">
        <div className="inner lp-row rev">
          <div className="lp-visual"><BareChat /></div>
          <div className="lp-copy">
            <div className="lp-eyebrow">대화</div>
            <h2>빈 노트는 그만,<br />말하면 마음이<br />정리돼요</h2>
            <p>맞춤법도, 형식도 신경 쓸 필요 없어요. 편하게 말하는 동안 나,다움이 꼬리에 꼬리를 무는 질문으로 오늘의 감정을 함께 풀어가요.</p>
          </div>
        </div>
      </section>

      <section className="lp-sec alt" id="sec-safe">
        <div className="inner lp-row">
          <div className="lp-copy">
            <div className="lp-eyebrow">안전</div>
            <h2>가장 내밀한 이야기도,<br />안심하고<br />털어놓으세요</h2>
            <p>이름·장소 같은 민감한 정보는 기기를 떠나기 전, 온디바이스에서 먼저 가려집니다. 기록이 남을까 망설이지 않아도 돼요.</p>
          </div>
          <div className="lp-visual"><MaskCard /></div>
        </div>
      </section>

      <section className="lp-sec" id="sec-feat">
        <div className="inner">
          <div style={{ textAlign: 'center' }}>
            <div className="lp-eyebrow">기능</div>
            <h2 style={{ fontSize: 'clamp(28px,3.8vw,44px)', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.32, color: '#191f28', marginTop: 14, fontFamily: 'var(--font-logo)' }}>
              마음 돌봄에 필요한<br />모든 것을 한 곳에
            </h2>
          </div>
          <div className="lp-features">
            {FEATURES.map((f) => (
              <div
                key={f.t}
                className="lp-feat"
                style={{ background: `radial-gradient(circle at 26% 20%, rgba(255,255,255,0.5), transparent 52%), radial-gradient(circle at 80% 88%, color-mix(in srgb, ${f.c} 55%, #fff), transparent 62%), linear-gradient(145deg, ${f.c}, color-mix(in srgb, ${f.c} 64%, #000))` }}
              >
                <h3>{f.t}</h3>
                <div className="fic">{Icon[f.ic]({ width: 40, height: 40 })}</div>
                <div className="feat-desc"><p>{f.d}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="lp-foot">
        <div><b>「나,다움」 · 멀티모달 기반 대화형 정서기록 플랫폼</b></div>
        <div>본 서비스는 진단·처방·치료를 제공하지 않는 비의료 정서 기록 보조 도구입니다.</div>
      </footer>
      </div>
    </div>
  );
}
