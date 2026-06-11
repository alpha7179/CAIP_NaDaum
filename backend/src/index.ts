// 「나,다움」 백엔드 진입점 — 합성 루트로 서버 조립 및 기동.

import 'dotenv/config';
import { composeBackend } from './boot/composeBackend.js';

function main(): void {
  const port = Number.parseInt(process.env['PORT'] ?? '3000', 10);
  const { server, aiProvider } = composeBackend();
  server.listen(port, () => {
    const mode = aiProvider === 'openai' ? 'OpenAI' : aiProvider === 'gemini' ? 'Gemini' : 'fake-AI';
    console.log(`[nadaum] backend listening on :${port} (external AI: ${mode})`);
  });
}

main();
