import type { HeaderPair, ParseStatus } from "./types";

const EVENT_HEADERS = ["x-github-event", "x-event-type", "x-webhook-event"];
const PROVIDER_HEADERS = [
  "x-github-delivery",
  "x-event-id",
  "x-webhook-id",
  "x-request-id",
];
const EVENT_KEYS = ["type", "event", "event_type", "action"];
const PROVIDER_KEYS = ["event_id", "id"];

export interface ParsedBody {
  status: ParseStatus;
  json: unknown;
  isJson: boolean;
}

export function headerValue(headers: HeaderPair[], name: string): string | null {
  const target = name.toLowerCase();
  for (const header of headers) {
    if (header.n.toLowerCase() === target) return header.v;
  }
  return null;
}

export function parseBody(
  raw: Uint8Array,
  contentType: string | null,
): ParsedBody {
  if (raw.byteLength === 0) {
    return { status: "empty", json: undefined, isJson: false };
  }

  const text = new TextDecoder("utf-8", { fatal: false }).decode(raw);
  const binary = text.includes("\uFFFD") && !text.includes("\u0000");
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return { status: "empty", json: undefined, isJson: false };
  }

  let parsed: unknown;
  let ok = true;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    ok = false;
  }

  const looksJson = trimmed.startsWith("{") || trimmed.startsWith("[");
  const declaredJson = (contentType ?? "").toLowerCase().includes("json");

  if (!ok) {
    return {
      status: binary || !(looksJson || declaredJson) ? "not_json" : "invalid_json",
      json: undefined,
      isJson: false,
    };
  }

  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    return { status: "ok", json: parsed, isJson: true };
  }

  return { status: "root_not_object", json: parsed, isJson: true };
}

export function extractEventType(headers: HeaderPair[], body: unknown): string {
  for (const name of EVENT_HEADERS) {
    const value = headerValue(headers, name);
    if (value && value.trim().length > 0) return value.trim().slice(0, 120);
  }

  if (body && typeof body === "object" && !Array.isArray(body)) {
    const record = body as Record<string, unknown>;
    for (const key of EVENT_KEYS) {
      const value = record[key];
      if (typeof value === "string" && value.trim().length > 0) {
        return value.trim().slice(0, 120);
      }
    }
  }

  return "_unknown";
}

export function extractProviderEventId(
  headers: HeaderPair[],
  body: unknown,
): string | null {
  for (const name of PROVIDER_HEADERS) {
    const value = headerValue(headers, name);
    if (value && value.trim().length > 0) return value.trim().slice(0, 200);
  }

  if (body && typeof body === "object" && !Array.isArray(body)) {
    const record = body as Record<string, unknown>;
    for (const key of PROVIDER_KEYS) {
      const value = record[key];
      if (typeof value === "string" && value.trim().length > 0) {
        return value.trim().slice(0, 200);
      }
    }
  }

  return null;
}

export function rawHeaders(request: Request): HeaderPair[] {
  const pairs: HeaderPair[] = [];
  const setCookies = request.headers.getSetCookie?.() ?? [];

  request.headers.forEach((v, n) => {
    // The Fetch API folds repeated headers into one comma-joined value. Keep
    // Set-Cookie as separate pairs because folding it changes the meaning.
    if (n.toLowerCase() === "set-cookie" && setCookies.length > 0) return;
    pairs.push({ n, v });
  });

  for (const cookie of setCookies) {
    pairs.push({ n: "set-cookie", v: cookie });
  }

  return pairs;
}
