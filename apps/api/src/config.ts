function readInt(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`${name} must be a valid integer`);
  }
  return parsed;
}

function readBool(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  return value === "true";
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: readInt("API_PORT", 4000),
  databaseUrl: requireEnv("DATABASE_URL"),
  authTokenSecret: requireEnv("AUTH_TOKEN_SECRET"),
  otpSalt: requireEnv("OTP_SALT"),
  otpTtlMinutes: readInt("OTP_TTL_MINUTES", 15),
  allowDebugOtp: readBool("ALLOW_DEBUG_OTP", true),
  adminEmails,
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
};

export type Config = typeof config;
