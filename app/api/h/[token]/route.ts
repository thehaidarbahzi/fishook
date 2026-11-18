import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { getStore } from "@/lib/store";
import {
  extractEventType,
  extractProviderEventId,
  parseBody,
  rawHeaders,
} from "@/lib/inspect";
import { hashToken } from "@/lib/token";
import { RATE_LIMITS, rateLimit } from "@/lib/ratelimit";
import { recomputeSchemaForType } from "@/lib/schema-service";
import type { HeaderPair } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 256 * 1024;

function json(body: unknown, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  const raw = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim();
  if (!raw) return null;
  return isIP(raw) ? raw : null;
}

async function readLimited(request: Request): Promise<Uint8Array | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BYTES) return null;

  const body = request.body;
  if (!body) return new Uint8Array();

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function rateLimited(retryAfter: number) {
  return json(
    { ok: false, error: "rate_limited" },
    429,
    { "Retry-After": String(retryAfter) },
  );
}

async function handle(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const method = request.method.toUpperCase();
  const ip = clientIp(request);

  const raw = await readLimited(request);
  if (raw === null) {
    const known = await getStore().getEndpointByTokenHash(hashToken(token));
    if (known) {
      await getStore().recordRejection(known.id);
    }
    return json({ ok: false, error: "payload_too_large" }, 413);
  }

  const tokenHash = hashToken(token);
  const store = getStore();
  const endpoint = await store.getEndpointByTokenHash(tokenHash);

  if (!endpoint) {
    const key = `ip:${ip ?? "unknown"}`;
    const burst = await rateLimit(
      `${key}:burst`,
      RATE_LIMITS.unknownIpBurst.max,
      RATE_LIMITS.unknownIpBurst.windowMs,
    );
    if (!burst.ok) return rateLimited(burst.retryAfter);
    const minute = await rateLimit(
      key,
      RATE_LIMITS.unknownIp.max,
      RATE_LIMITS.unknownIp.windowMs,
    );
    if (!minute.ok) return rateLimited(minute.retryAfter);
    return json({ ok: false, error: "unknown_endpoint" }, 404);
  }

  const burst = await rateLimit(
    `tok:${tokenHash}:burst`,
    RATE_LIMITS.tokenBurst.max,
    RATE_LIMITS.tokenBurst.windowMs,
  );
  if (!burst.ok) {
    await store.recordRejection(endpoint.id);
    return rateLimited(burst.retryAfter);
  }

  const minute = await rateLimit(
    `tok:${tokenHash}`,
    RATE_LIMITS.token.max,
    RATE_LIMITS.token.windowMs,
  );
  if (!minute.ok) {
    await store.recordRejection(endpoint.id);
    return rateLimited(minute.retryAfter);
  }

  const headers: HeaderPair[] = rawHeaders(request);
  const contentType = request.headers.get("content-type");
  const parsed = parseBody(raw, contentType);
  const eventType = extractEventType(headers, parsed.json);
  const providerEventId = extractProviderEventId(headers, parsed.json);
  const url = new URL(request.url);

  const summary = await store.insertEvent({
    endpointId: endpoint.id,
    tokenHash,
    eventType,
    providerEventId,
    method,
    path: "/api/h/:token",
    queryString: url.search ? url.search.slice(1) : null,
    headers,
    rawBody: raw,
    bodySha256: createHash("sha256").update(raw).digest("hex"),
    bodySize: raw.byteLength,
    contentType,
    parseStatus: parsed.status,
    sourceIp: ip,
  });

  if (parsed.status === "ok" || parsed.status === "root_not_object") {
    await recomputeSchemaForType(store, endpoint.id, eventType);
  }

  if (method === "HEAD") {
    return new Response(null, {
      status: 202,
      headers: { "X-Fishook-Seq": String(summary.seq) },
    });
  }

  return json({ ok: true, seq: summary.seq }, 202, {
    "X-Fishook-Seq": String(summary.seq),
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  return handle(request, context);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  return handle(request, context);
}

export async function HEAD(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  return handle(request, context);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "GET, HEAD, POST, OPTIONS",
      "Cache-Control": "no-store",
    },
  });
}
