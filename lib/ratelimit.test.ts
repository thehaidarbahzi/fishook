import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { RATE_LIMITS, rateLimit } from "./ratelimit";

beforeAll(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

describe("rateLimit", () => {
  it("allows requests up to the limit and rejects the next one", async () => {
    const key = randomUUID();
    const first = await rateLimit(key, 2, 60_000);
    const second = await rateLimit(key, 2, 60_000);
    const third = await rateLimit(key, 2, 60_000);

    expect(first.ok).toBe(true);
    expect(first.remaining).toBe(1);
    expect(second.ok).toBe(true);
    expect(second.remaining).toBe(0);
    expect(third.ok).toBe(false);
    expect(third.retryAfter).toBeGreaterThan(0);
    expect(third.retryAfter).toBeLessThanOrEqual(60);
  });

  it("keeps buckets separate", async () => {
    const a = randomUUID();
    const b = randomUUID();
    await rateLimit(a, 1, 60_000);
    expect((await rateLimit(a, 1, 60_000)).ok).toBe(false);
    expect((await rateLimit(b, 1, 60_000)).ok).toBe(true);
  });

  it("exposes the ingest limits from the spec", () => {
    expect(RATE_LIMITS.token.max).toBe(60);
    expect(RATE_LIMITS.unknownIp.max).toBe(20);
    expect(RATE_LIMITS.token.windowMs).toBe(60_000);
  });
});
