// 노션 공개 API 호출 어댑터(내부 통합 토큰 방식)

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

export class NotionApiError extends Error {
  public readonly status: number;
  public constructor(status: number, message: string) {
    super(message);
    this.name = 'NotionApiError';
    this.status = status;
  }
}

export interface NotionBotInfo {
  readonly workspaceName?: string;
}

export async function getBotInfo(token: string): Promise<NotionBotInfo> {
  const res = await fetch(`${NOTION_API}/users/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
    },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = typeof data.message === 'string' ? data.message : `토큰 검증 실패 (${res.status})`;
    throw new NotionApiError(res.status, msg);
  }
  const bot = (data.bot ?? {}) as { workspace_name?: unknown };
  return {
    ...(typeof bot.workspace_name === 'string' ? { workspaceName: bot.workspace_name } : {}),
  };
}

export function parsePageId(input: string): string | undefined {
  const trimmed = input.trim();
  if (trimmed.length === 0) return undefined;
  const path = trimmed.split(/[?#]/)[0] ?? '';
  const seg = path.split('/').filter((s) => s.length > 0).pop() ?? trimmed;
  const dashed = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(seg);
  if (dashed?.[1]) return dashed[1].toLowerCase();
  const compact = /([0-9a-f]{32})$/i.exec(seg);
  if (compact?.[1]) {
    const h = compact[1].toLowerCase();
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  return undefined;
}

export async function getPageById(
  token: string,
  pageId: string,
): Promise<{ pageId: string; title: string }> {
  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
    },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || typeof data.id !== 'string') {
    const msg = typeof data.message === 'string' ? data.message : `페이지 조회 실패 (${res.status})`;
    throw new NotionApiError(res.status, msg);
  }
  return { pageId: data.id, title: extractPageTitle(data.properties as Record<string, unknown> | undefined) };
}

export async function findFirstAccessiblePage(
  token: string,
): Promise<{ pageId: string; title: string } | undefined> {
  const res = await fetch(`${NOTION_API}/search`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION,
    },
    body: JSON.stringify({
      filter: { property: 'object', value: 'page' },
      page_size: 10,
    }),
  });
  if (!res.ok) return undefined;
  const data = (await res.json().catch(() => ({}))) as { results?: unknown[] };
  const results = Array.isArray(data.results) ? data.results : [];
  for (const r of results) {
    const page = r as { id?: unknown; properties?: Record<string, unknown> };
    if (typeof page.id === 'string') {
      return { pageId: page.id, title: extractPageTitle(page.properties) };
    }
  }
  return undefined;
}

export async function createPage(
  token: string,
  parentPageId: string,
  title: string,
  children: ReadonlyArray<Record<string, unknown>>,
): Promise<{ url: string; id: string }> {
  const res = await fetch(`${NOTION_API}/pages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION,
    },
    body: JSON.stringify({
      parent: { page_id: parentPageId },
      properties: {
        title: { title: [{ type: 'text', text: { content: title.slice(0, 2000) } }] },
      },
      children,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || typeof data.id !== 'string') {
    const msg = typeof data.message === 'string' ? data.message : `페이지 생성 실패 (${res.status})`;
    throw new NotionApiError(res.status, msg);
  }
  return { id: data.id, url: typeof data.url === 'string' ? data.url : '' };
}

function extractPageTitle(properties: Record<string, unknown> | undefined): string {
  if (!properties) return '제목 없음';
  for (const value of Object.values(properties)) {
    const prop = value as { type?: string; title?: Array<{ plain_text?: string }> };
    if (prop?.type === 'title' && Array.isArray(prop.title)) {
      const text = prop.title.map((t) => t.plain_text ?? '').join('').trim();
      if (text.length > 0) return text;
    }
  }
  return '제목 없음';
}
