import crypto from "node:crypto";

interface TokenPayload {
  sub: string;
  role: "user" | "admin";
  email: string;
  iat: number;
  exp: number;
}

function base64Url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

function fromBase64Url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(input: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(input).digest("base64url");
}

export function createAuthToken(
  subject: { id: string; role: "user" | "admin"; email: string },
  secret: string,
  expiresInSeconds = 60 * 60 * 24,
): string {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const issuedAt = Math.floor(Date.now() / 1000);
  const payloadObj: TokenPayload = {
    sub: subject.id,
    role: subject.role,
    email: subject.email,
    iat: issuedAt,
    exp: issuedAt + expiresInSeconds,
  };
  const payload = base64Url(JSON.stringify(payloadObj));
  const unsigned = `${header}.${payload}`;
  const signature = sign(unsigned, secret);
  return `${unsigned}.${signature}`;
}

export function verifyAuthToken(token: string, secret: string): TokenPayload | null {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) {
    return null;
  }

  const unsigned = `${header}.${payload}`;
  const expectedSignature = sign(unsigned, secret);
  if (signature.length !== expectedSignature.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return null;
  }

  const payloadJson = fromBase64Url(payload);
  const parsed = JSON.parse(payloadJson) as TokenPayload;
  const now = Math.floor(Date.now() / 1000);
  if (parsed.exp < now) {
    return null;
  }
  return parsed;
}
