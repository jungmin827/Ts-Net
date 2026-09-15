import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";

// 전화번호는 평문 저장·로깅 금지. 반드시 이 모듈을 거쳐
// phone_enc / phone_hash / phone_masked 3종으로만 다룬다. (CLAUDE.md 규칙 3)

const ALG = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function encryptionKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY는 32바이트 hex(64자)여야 합니다");
  }
  return Buffer.from(hex, "hex");
}

/** "010-1234-5678" → "01012345678" */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** phone_hash — 당일 중복접수 검사용. 정규화번호 + PEPPER */
export function hashPhone(normalized: string): string {
  const pepper = process.env.PHONE_PEPPER;
  if (!pepper) throw new Error("PHONE_PEPPER가 설정되지 않았습니다");
  return createHash("sha256").update(normalized + pepper).digest("hex");
}

/** phone_enc — base64(iv ‖ authTag ‖ ciphertext) */
export function encryptPhone(normalized: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
}

/** 복호화는 어드민 상세조회·엑셀 내보내기에서만 호출하고, 호출부는 반드시 access_logs에 기록한다 */
export function decryptPhone(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALG, encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

/** "01012345678" → "010-****-5678" */
export function maskPhone(normalized: string): string {
  return `${normalized.slice(0, 3)}-****-${normalized.slice(-4)}`;
}
