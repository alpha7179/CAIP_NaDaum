// 경량 마크다운 → React 노드 렌더러 (노션 스타일, XSS 안전)

import { createElement, type ReactNode } from 'react';

const INLINE_RE =
  /\*\*(.+?)\*\*|__(.+?)__|`([^`]+?)`|\[([^\]]+?)\]\(([^)]+?)\)|\*(.+?)\*|_(.+?)_/g;

function renderInline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyBase}-i${i++}`;
    const bold = m[1] ?? m[2];
    const code = m[3];
    const linkText = m[4];
    const linkHref = m[5];
    const italic = m[6] ?? m[7];
    if (bold !== undefined) {
      out.push(<strong key={key}>{bold}</strong>);
    } else if (code !== undefined) {
      out.push(
        <code
          key={key}
          style={{ background: 'var(--surface-3)', borderRadius: 5, padding: '1px 6px', fontSize: '0.88em', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
        >
          {code}
        </code>,
      );
    } else if (linkText !== undefined && linkHref !== undefined) {
      out.push(
        <a key={key} href={linkHref} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
          {linkText}
        </a>,
      );
    } else if (italic !== undefined) {
      out.push(<em key={key}>{italic}</em>);
    }
    last = INLINE_RE.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const HEADING_SIZES: readonly number[] = [27, 23, 19, 17, 15.5, 14];

export function renderMarkdown(src: string): ReactNode {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const at = (k: number): string => lines[k] ?? '';
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = at(i);

    if (line.trim() === '') { i++; continue; }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push(<hr key={key++} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '22px 0' }} />);
      i++;
      continue;
    }

    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = (h[1] ?? '#').length;
      const size = HEADING_SIZES[level - 1] ?? 16;
      blocks.push(
        createElement(
          `h${level}`,
          {
            key: key++,
            style: { fontSize: size, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.35, margin: level === 1 ? '4px 0 10px' : '20px 0 8px', color: 'var(--text)' },
          },
          renderInline(h[2] ?? '', `h${key}`),
        ),
      );
      i++;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(at(i))) {
        quoted.push(at(i).replace(/^\s*>\s?/, ''));
        i++;
      }
      blocks.push(
        <blockquote
          key={key++}
          style={{ margin: '12px 0', padding: '4px 0 4px 16px', borderLeft: '3px solid var(--border-strong)', color: 'var(--text-2)', fontSize: 15 }}
        >
          {renderInline(quoted.join(' '), `q${key}`)}
        </blockquote>,
      );
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(at(i))) {
        items.push(at(i).replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={key++} style={{ margin: '10px 0', paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((it, idx) => (
            <li key={idx} style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-2)' }}>{renderInline(it, `ul${key}-${idx}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(at(i))) {
        items.push(at(i).replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      blocks.push(
        <ol key={key++} style={{ margin: '10px 0', paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((it, idx) => (
            <li key={idx} style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-2)' }}>{renderInline(it, `ol${key}-${idx}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length &&
      at(i).trim() !== '' &&
      !/^(#{1,6})\s+/.test(at(i)) &&
      !/^\s*>\s?/.test(at(i)) &&
      !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(at(i)) &&
      !/^\s*[-*]\s+/.test(at(i)) &&
      !/^\s*\d+\.\s+/.test(at(i))
    ) {
      para.push(at(i));
      i++;
    }
    blocks.push(
      <p key={key++} style={{ fontSize: 15, lineHeight: 1.75, color: 'var(--text-2)', margin: '0 0 12px' }}>
        {para.map((seg, idx) => (
          <span key={idx}>
            {renderInline(seg, `p${key}-${idx}`)}
            {idx < para.length - 1 && <br />}
          </span>
        ))}
      </p>,
    );
  }

  return <>{blocks}</>;
}
