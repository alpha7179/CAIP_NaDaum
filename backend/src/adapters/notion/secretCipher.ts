// DB 저장 민감 토큰의 at-rest 암호화(AES-256-GCM)

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const PREFIX = 'enc:v1:';
const IV_LEN = 12;
const TAG_LEN = 16;

function deriveKey(keyStr: string): Buffer {
  return createHash('sha256').update(keyStr, 'utf8').digest();
}

export function encryptSecret(plain: string, keyStr: string | undefined): string {
  if (keyStr === undefined || keyStr.length === 0) return plain;
  const key = deriveKey(keyStr);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

export function decryptSecret(stored: string, keyStr: string | undefined): string {
  if (!stored.startsWith(PREFIX)) return stored;
  if (keyStr === undefined || keyStr.length === 0) {
    throw new Error('NOTION_TOKEN_ENC_KEY가 없어 암호화된 토큰을 복호화할 수 없습니다.');
  }
  const raw = Buffer.from(stored.slice(PREFIX.length), 'base64');
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = raw.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(keyStr), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
