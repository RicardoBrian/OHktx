import crypto from "crypto";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY가 없거나 길이가 잘못되었습니다. `openssl rand -hex 32` 로 생성한 64자리 hex 문자열을 .env에 넣으세요."
    );
  }
  return Buffer.from(hex, "hex");
}

// 저장 포맷: base64(iv).base64(authTag).base64(ciphertext)
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(".");
}

export function decrypt(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("암호화된 데이터 형식이 올바르지 않습니다.");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  return plaintext.toString("utf8");
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // 길이가 다르면 무조건 false이지만, 비교 자체는 상수시간 유지를 위해 더미 비교 수행
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}
