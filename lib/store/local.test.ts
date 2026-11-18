import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LocalStore } from "./local";
import { recomputeSchemaForType } from "../schema-service";
import type { NewEvent } from "../types";

function freshStore() {
  const dir = mkdtempSync(path.join(tmpdir(), "fishook-store-"));
  return new LocalStore(dir);
}

function event(
  endpointId: string,
  body: string,
  overrides: Partial<NewEvent> = {},
): NewEvent {
  const bytes = new TextEncoder().encode(body);
  return {
    endpointId,
    tokenHash: "hash",
    eventType: "payment.succeeded",
    providerEventId: null,
    method: "POST",
    path: "/api/h/:token",
    queryString: null,
    headers: [{ n: "content-type", v: "application/json" }],
    rawBody: bytes,
    bodySha256: createHash("sha256").update(bytes).digest("hex"),
    bodySize: bytes.byteLength,
    contentType: "application/json",
    parseStatus: "ok",
    sourceIp: "127.0.0.1",
    ...overrides,
  };
}

describe("LocalStore", () => {
  it("keeps the raw bytes intact, including NUL and invalid UTF-8", async () => {
    const store = freshStore();
    const endpoint = await store.createEndpoint("hash", "tail");
    const raw = new Uint8Array([0x7b, 0xff, 0x00, 0x7d]);

    await store.insertEvent(
      event(endpoint.id, "", {
        rawBody: raw,
        bodySha256: createHash("sha256").update(raw).digest("hex"),
        bodySize: raw.byteLength,
        parseStatus: "not_json",
      }),
    );

    const summaries = await store.listEvents(endpoint.id, { limit: 10 });
    expect(summaries).toHaveLength(1);
    const detail = await store.getEvent(endpoint.id, summaries[0].seq);
    expect(detail).not.toBeNull();
    expect(Buffer.from(detail!.rawBodyBase64, "base64")).toEqual(Buffer.from(raw));
    expect(detail!.bodySha256).toBe(
      createHash("sha256").update(raw).digest("hex"),
    );
  });

  it("returns events newest first and supports afterSeq", async () => {
    const store = freshStore();
    const endpoint = await store.createEndpoint("hash", "tail");
    const first = await store.insertEvent(event(endpoint.id, '{"n":1}'));
    const second = await store.insertEvent(event(endpoint.id, '{"n":2}'));
    const third = await store.insertEvent(event(endpoint.id, '{"n":3}'));

    const all = await store.listEvents(endpoint.id, { limit: 10 });
    expect(all.map((row) => row.seq)).toEqual([third.seq, second.seq, first.seq]);

    const after = await store.listEvents(endpoint.id, {
      limit: 10,
      afterSeq: first.seq,
    });
    expect(after.map((row) => row.seq)).toEqual([third.seq, second.seq]);
  });

  it("marks a repeated provider event id as a duplicate without dropping it", async () => {
    const store = freshStore();
    const endpoint = await store.createEndpoint("hash", "tail");
    const first = await store.insertEvent(
      event(endpoint.id, '{"id":"evt_1"}', { providerEventId: "evt_1" }),
    );
    const second = await store.insertEvent(
      event(endpoint.id, '{"id":"evt_1"}', { providerEventId: "evt_1" }),
    );

    expect(first.isDuplicate).toBe(false);
    expect(second.isDuplicate).toBe(true);
    expect(second.duplicateOf).toBe(first.id);
    expect(await store.countEvents(endpoint.id)).toBe(2);
  });

  it("does not treat the same id on another endpoint as a duplicate", async () => {
    const store = freshStore();
    const a = await store.createEndpoint("hash-a", "aaaa");
    const b = await store.createEndpoint("hash-b", "bbbb");
    await store.insertEvent(
      event(a.id, '{"id":"evt_1"}', { providerEventId: "evt_1" }),
    );
    const other = await store.insertEvent(
      event(b.id, '{"id":"evt_1"}', { providerEventId: "evt_1" }),
    );
    expect(other.isDuplicate).toBe(false);
  });

  it("counts rejections in the last hour", async () => {
    const store = freshStore();
    const endpoint = await store.createEndpoint("hash", "tail");
    await store.recordRejection(endpoint.id);
    await store.recordRejection(endpoint.id);
    const again = await store.getEndpoint(endpoint.id);
    expect(await store.rejectedLastHour(endpoint.id)).toBe(2);
    expect(again?.rejectedLastHour).toBe(2);
  });

  it("prunes to the requested event cap", async () => {
    const store = freshStore();
    const endpoint = await store.createEndpoint("hash", "tail");
    await store.insertEvent(event(endpoint.id, '{"n":1}'));
    await store.insertEvent(event(endpoint.id, '{"n":2}'));
    await store.insertEvent(event(endpoint.id, '{"n":3}'));

    await store.pruneEvents(endpoint.id, 2);
    const remaining = await store.listEvents(endpoint.id, { limit: 10 });
    expect(remaining.map((row) => row.seq)).toEqual([3, 2]);
  });

  it("recomputes a schema from stored bodies", async () => {
    const store = freshStore();
    const endpoint = await store.createEndpoint("hash", "tail");
    await store.insertEvent(event(endpoint.id, '{"id":"a"}'));
    await store.insertEvent(event(endpoint.id, '{"id":"b","coupon":"SAVE"}'));

    const doc = await recomputeSchemaForType(store, endpoint.id, "payment.succeeded");
    expect(doc?.samples).toBe(2);
    expect(doc?.root.fields.coupon.present).toBe(1);

    const schemas = await store.getSchemas(endpoint.id);
    expect(Object.keys(schemas)).toEqual(["payment.succeeded"]);
    expect(schemas["payment.succeeded"].samples).toBe(2);
  });

  it("removes the schema when no parseable samples remain", async () => {
    const store = freshStore();
    const endpoint = await store.createEndpoint("hash", "tail");
    await store.insertEvent(event(endpoint.id, "not json", { parseStatus: "not_json" }));
    const doc = await recomputeSchemaForType(store, endpoint.id, "payment.succeeded");
    expect(doc).toBeNull();
    expect(await store.getSchemas(endpoint.id)).toEqual({});
  });

  it("deletes the endpoint, its events, rejections, and schemas", async () => {
    const store = freshStore();
    const endpoint = await store.createEndpoint("hash", "tail");
    await store.insertEvent(event(endpoint.id, '{"id":"a"}'));
    await recomputeSchemaForType(store, endpoint.id, "payment.succeeded");
    await store.recordRejection(endpoint.id);

    await store.deleteEndpoint(endpoint.id);

    expect(await store.getEndpoint(endpoint.id)).toBeNull();
    expect(await store.countEvents(endpoint.id)).toBe(0);
    expect(await store.getSchemas(endpoint.id)).toEqual({});
    expect(await store.rejectedLastHour(endpoint.id)).toBe(0);
  });

  it("rotates the stored token hash without touching events", async () => {
    const store = freshStore();
    const endpoint = await store.createEndpoint("hash-old", "old1");
    await store.insertEvent(event(endpoint.id, '{"id":"a"}'));

    await store.rotateToken(endpoint.id, "hash-new", "new2");
    expect(await store.getEndpointByTokenHash("hash-old")).toBeNull();
    const rotated = await store.getEndpointByTokenHash("hash-new");
    expect(rotated?.id).toBe(endpoint.id);
    expect(rotated?.tokenTail).toBe("new2");
    expect(await store.countEvents(endpoint.id)).toBe(1);
  });

  it("preserves repeated headers as separate pairs", async () => {
    const store = freshStore();
    const endpoint = await store.createEndpoint("hash", "tail");
    await store.insertEvent(
      event(endpoint.id, '{"id":"a"}', {
        headers: [
          { n: "set-cookie", v: "a=1" },
          { n: "set-cookie", v: "b=2" },
        ],
      }),
    );
    const [summary] = await store.listEvents(endpoint.id, { limit: 1 });
    const detail = await store.getEvent(endpoint.id, summary.seq);
    expect(detail?.headers).toEqual([
      { n: "set-cookie", v: "a=1" },
      { n: "set-cookie", v: "b=2" },
    ]);
  });
});
