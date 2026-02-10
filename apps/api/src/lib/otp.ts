import crypto from "node:crypto";

export function generateOtpCode(): string {
  return crypto.randomInt(100000, 1_000_000).toString();
}

export function hashOtpCode(code: string, salt: string): string {
  return crypto.createHash("sha256").update(`${code}:${salt}`).digest("hex");
}
