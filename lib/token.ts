import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_BYTES = 16;
const COOKIE_NAME = "fishook_session";
const DEV_SECRET = "fishook-dev-secret-change-me";

export function newToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function tokenTail(token: string): string {
  return token.slice(-4);
}

function cookieSecret(): string {
  const secret = process.env.FISHOOK_COOKIE_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
    throw new Error(
      "FISHOOK_COOKIE_SECRET is required in production. Use at least 16 characters.",
    );
  }
  return DEV_SECRET;
}

export interface SessionPayload {
  endpointId: string;
  token: string;
}

/**
 * The read cookie is signed and httpOnly. The write token travels inside it so
 * the URL can be shown again later without storing the raw token in Postgres.
 */
export function signSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const mac = createHmac("sha256", cookieSecret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verifySession(value: string | undefined | null): SessionPayload | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0 || dot === value.length - 1) return null;
  const body = value.slice(0, dot);
  const mac = value.slice(dot + 1);
  const expected = createHmac("sha256", cookieSecret()).update(body).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as SessionPayload).endpointId === "string" &&
      typeof (parsed as SessionPayload).token === "string"
    ) {
      return parsed as SessionPayload;
    }
  } catch {
    return null;
  }
  return null;
}

export const SESSION_COOKIE = COOKIE_NAME;

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

export function webhookPath(token: string): string {
  return `/api/h/${token}`;
}

export function webhookUrl(token: string, origin: string): string {
  return `${origin.replace(/\/$/, "")}${webhookPath(token)}`;
}
