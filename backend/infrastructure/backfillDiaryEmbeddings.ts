// 일기 임베딩 백필 스크립트 (회상 RAG 확장)
import pg from 'pg';

import { PassthroughHook } from '../src/adapters/ai-gateway/PassthroughHook.js';
import { createBoundGateway } from '../src/adapters/ai-gateway/boundGateway.js';
import { createOpenAiEmbeddingAdapter } from '../src/adapters/ai-gateway/openai/OpenAiEmbeddingAdapter.js';
import { GatewayDiaryEmbedder, type EmbeddingAIGateway } from '../src/adapters/diary-recall/GatewayDiaryEmbedder.js';
import { AIGatewayImpl } from '../src/domain/ai-gateway/AIGateway.js';

const { Client } = pg;

interface PendingRow {
  diary_id: string;
  user_id: string;
  body: string;
}

async function main(): Promise<void> {
  const connectionString = process.env['DATABASE_URL'];
  const openAiKey = process.env['OPENAI_API_KEY'];
  const openAiBaseUrl = process.env['OPENAI_BASE_URL'];
  const limit = Number.parseInt(process.env['BACKFILL_LIMIT'] ?? '1000', 10);

  if (typeof connectionString !== 'string' || connectionString.length === 0) {
    console.error('[backfill] DATABASE_URL environment variable is required.');
    process.exit(1);
  }
  if (typeof openAiKey !== 'string' || openAiKey.length === 0) {
    console.error('[backfill] OPENAI_API_KEY environment variable is required.');
    process.exit(1);
  }

  const gateway = new AIGatewayImpl(new PassthroughHook());
  gateway.registerAdapter(
    'embedding',
    createOpenAiEmbeddingAdapter({
      apiKey: openAiKey,
      ...(typeof openAiBaseUrl === 'string' && openAiBaseUrl.length > 0
        ? { baseUrl: openAiBaseUrl }
        : {}),
    }),
  );
  const bound = createBoundGateway(gateway, { userId: 'system' });
  const embedder = new GatewayDiaryEmbedder({ gateway: bound as unknown as EmbeddingAIGateway });

  const client = new Client({ connectionString });
  await client.connect();
  let processed = 0;
  let failed = 0;
  try {
    const { rows } = await client.query<PendingRow>(
      `SELECT diary_id, user_id, body
         FROM diary_entries
        WHERE embedding IS NULL
        ORDER BY created_at ASC
        LIMIT $1`,
      [Number.isFinite(limit) && limit > 0 ? limit : 1000],
    );
    console.log(`[backfill] pending rows: ${rows.length}`);
    for (const row of rows) {
      try {
        const vector = await embedder.embed(row.body);
        if (vector.length === 0) {
          continue;
        }
        const literal = `[${vector.join(',')}]`;
        await client.query(
          `UPDATE diary_entries
              SET embedding = $3::vector
            WHERE user_id = $1 AND diary_id = $2`,
          [row.user_id, row.diary_id, literal],
        );
        processed += 1;
      } catch (e) {
        failed += 1;
        console.warn(`[backfill] skip ${row.diary_id}: ${(e as Error).message}`);
      }
    }
    console.log(`[backfill] done: processed=${processed} failed=${failed}`);
  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  console.error('[backfill] failed:', err);
  process.exit(1);
});
