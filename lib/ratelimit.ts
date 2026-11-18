export interface RateResult {
  ok: boolean;
  remaining: number;
  retryAfter: number;
}

interface MemoryBucket {
  hits: number[];
}

const globalLimiter = globalThis as unknown as {
  __fishookBuckets?: Map<string, MemoryBucket>;
};

function memoryLimit(key: string, max: number, windowMs: number): RateResult {
  if (!globalLimiter.__fishookBuckets) {
    globalLimiter.__fishookBuckets = new Map();
  }
  const buckets = globalLimiter.__fishookBuckets;
  const now = Date.now();
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((at) => now - at < windowMs);

  if (bucket.hits.length >= max) {
    const oldest = bucket.hits[0];
    const retryAfter = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    buckets.set(key, bucket);
    return { ok: false, remaining: 0, retryAfter };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);

  if (buckets.size > 10_000) {
    for (const [bucketKey, value] of buckets) {
      if (value.hits.every((at) => now - at >= windowMs)) buckets.delete(bucketKey);
    }
  }

  return { ok: true, remaining: max - bucket.hits.length, retryAfter: 0 };
}

async function upstashLimit(
  url: string,
  token: string,
  key: string,
  max: number,
  windowMs: number,
): Promise<RateResult> {
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, windowSec, "NX"],
      ["TTL", key],
    ]),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Upstash rate limit failed with ${response.status}`);
  }

  const data = (await response.json()) as { result: number | string | null }[];
  const count = Number(data[0]?.result ?? 0);
  const ttl = Number(data[2]?.result ?? windowSec);
  if (count > max) {
    return { ok: false, remaining: 0, retryAfter: Math.max(1, ttl) };
  }
  return { ok: true, remaining: Math.max(0, max - count), retryAfter: 0 };
}

/**
 * Fixed-window limiter. Uses Upstash when configured, otherwise an in-process
 * map. The in-process map is not shared between serverless instances, so the
 * Upstash path is the one that holds in production.
 */
export async function rateLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<RateResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    try {
      return await upstashLimit(url, token, `rl:${key}`, max, windowMs);
    } catch (error) {
      console.error("fishook: rate limiter unavailable, allowing request", error);
      return { ok: true, remaining: max, retryAfter: 0 };
    }
  }

  return memoryLimit(key, max, windowMs);
}

export const RATE_LIMITS = {
  token: { max: 60, windowMs: 60_000 },
  tokenBurst: { max: 20, windowMs: 10_000 },
  unknownIp: { max: 20, windowMs: 60_000 },
  unknownIpBurst: { max: 8, windowMs: 10_000 },
};
