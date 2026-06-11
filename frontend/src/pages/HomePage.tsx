// 차분형 홈 (오브 + 대화 시작 + 바로가기)
import type { DiaryEntry } from '@nadaum/shared';

import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { WaveOrb } from '../components/WaveOrb';
import type { SampleDiary } from '../data/sampleDiary';

type GoFn = (r: string, p?: string) => void;

export function formatDiaryDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일`;
}

export function deriveTitle(body: string): string {
  const first = body.split(/[.!?。\n]/)[0]?.trim() ?? '';
  if (first.length === 0) return '오늘의 기록';
  return first.length > 24 ? first.slice(0, 24) + '…' : first;
}

export function DiaryCardRow({ d, go }: { d: DiaryEntry | SampleDiary; go: GoFn }) {
  const isSample = 'date' in d;
  const date = isSample ? (d).date : formatDiaryDate((d).sessionDate);
  const weekday = isSample ? (d).weekday : '';
  const mood = isSample ? (d).mood : '';
  const title = isSample
    ? (d).title
    : ((d).title || deriveTitle((d).body));
  const excerpt = isSample ? (d).excerpt : (d).body.slice(0, 80) + '…';
  const tags = isSample ? (d).tags : ((d).tags ?? []);
  const id = isSample ? (d).id : (d).diaryId;

  return (
    <button className="diary-card" onClick={() => go('detail', id)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
        <div className="diary-date">{date}{weekday ? ` · ${weekday}` : ''}</div>
        {mood && <div className="diary-mood">{mood}</div>}
      </div>
      <div className="diary-title">{title}</div>
      <div className="diary-excerpt">{excerpt}</div>
      {tags.length > 0 && (
        <div className="tag-row">{tags.map((t) => <span className="tag" key={t}>#{t}</span>)}</div>
      )}
    </button>
  );
}

function hourGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return '고요한 새벽이에요';
  if (h < 12) return '좋은 아침이에요';
  if (h < 18) return '나른한 오후예요';
  if (h < 22) return '하루를 마무리할 시간이에요';
  return '깊은 밤이에요';
}

export function HomePage({ go }: { go: GoFn }) {
  const { name } = useAuth();
  const nm = name || '나';
  const greet = hourGreeting();
  const orbSize = Math.min(260, Math.max(200, window.innerWidth - 80));

  return (
    <div className="page fade">
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <div className="eyebrow">{greet}</div>
        <h1 className="greet" style={{ marginTop: 12 }}>
          {nm}님,<br />오늘의 <span className="accent">나</span>를 들려주세요
        </h1>
      </div>

      <div style={{ display: 'grid', placeItems: 'center', margin: '10px 0 40px' }}>
        <WaveOrb size={orbSize} />
        <button className="btn btn-primary btn-pill" style={{ marginTop: 4 }} onClick={() => go('chat')}>
          <Icon.chat width={18} height={18} /> 대화 시작하기
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button
          className="diary-card"
          onClick={() => go('diary')}
          style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px' }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon.book width={22} height={22} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div className="diary-title" style={{ margin: 0 }}>일기 확인하기</div>
            <div className="diary-excerpt" style={{ marginTop: 4 }}>대화로 쌓인 나의 하루를 다시 읽어요</div>
          </div>
          <Icon.arrow width={18} height={18} style={{ marginLeft: 'auto', color: 'var(--text-3)', flexShrink: 0 }} />
        </button>
      </div>

    </div>
  );
}
