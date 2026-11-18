import { describe, expect, it } from "vitest";
import {
  extractEventType,
  extractProviderEventId,
  headerValue,
  parseBody,
  rawHeaders,
} from "./inspect";

const enc = (text: string) => new TextEncoder().encode(text);

describe("parseBody", () => {
  it("marks an empty body", () => {
    expect(parseBody(new Uint8Array(), "application/json").status).toBe("empty");
    expect(parseBody(enc("   "), "application/json").status).toBe("empty");
  });

  it("parses a root object", () => {
    const result = parseBody(enc('{"a":1}'), "application/json");
    expect(result.status).toBe("ok");
    expect(result.json).toEqual({ a: 1 });
  });

  it("marks a root array as root_not_object", () => {
    const result = parseBody(enc("[1,2,3]"), "application/json");
    expect(result.status).toBe("root_not_object");
    expect(result.json).toEqual([1, 2, 3]);
  });

  it("marks a root scalar as root_not_object", () => {
    expect(parseBody(enc("42"), "application/json").status).toBe("root_not_object");
    expect(parseBody(enc('"hi"'), "application/json").status).toBe("root_not_object");
  });

  it("separates invalid JSON from a non-JSON body", () => {
    expect(parseBody(enc('{"a":'), "application/json").status).toBe("invalid_json");
    expect(parseBody(enc('{"a":'), "text/plain").status).toBe("invalid_json");
    expect(parseBody(enc("hello"), "application/json").status).toBe("invalid_json");
    expect(parseBody(enc("hello"), "text/plain").status).toBe("not_json");
  });

  it("does not throw on a body that is not valid UTF-8", () => {
    const bytes = new Uint8Array([0xff, 0xfe, 0x00, 0x7b]);
    expect(() => parseBody(bytes, null)).not.toThrow();
  });
});

describe("event type extraction", () => {
  it("prefers GitHub's header", () => {
    const headers = [
      { n: "x-event-type", v: "ignored" },
      { n: "x-github-event", v: "pull_request" },
    ];
    expect(extractEventType(headers, { type: "body" })).toBe("pull_request");
  });

  it("falls back through headers and then the body", () => {
    expect(extractEventType([{ n: "x-event-type", v: "invoice.paid" }], {})).toBe("invoice.paid");
    expect(extractEventType([], { event: "customer.created" })).toBe("customer.created");
    expect(extractEventType([], { event_type: "refund.created" })).toBe("refund.created");
    expect(extractEventType([], { action: "opened" })).toBe("opened");
  });

  it("falls back to _unknown", () => {
    expect(extractEventType([], {})).toBe("_unknown");
    expect(extractEventType([], [1, 2])).toBe("_unknown");
  });

  it("trims and caps the value at 120 characters", () => {
    const long = `  ${"a".repeat(300)}  `;
    expect(extractEventType([], { type: long })).toHaveLength(120);
  });

  it("matches header names case-insensitively", () => {
    expect(headerValue([{ n: "X-Event-Type", v: "ping" }], "x-event-type")).toBe("ping");
  });
});

describe("provider event id extraction", () => {
  it("reads a delivery header", () => {
    expect(extractProviderEventId([{ n: "x-github-delivery", v: "abc" }], {})).toBe("abc");
  });

  it("reads a body id only when it is a string", () => {
    expect(extractProviderEventId([], { event_id: "evt_1" })).toBe("evt_1");
    expect(extractProviderEventId([], { id: "evt_2" })).toBe("evt_2");
    expect(extractProviderEventId([], { id: 7 })).toBeNull();
  });

  it("returns null when nothing identifies the event", () => {
    expect(extractProviderEventId([], {})).toBeNull();
  });
});

describe("rawHeaders", () => {
  it("keeps each Set-Cookie value exactly once", () => {
    const one = new Request("http://localhost/api/h/x", {
      headers: { "set-cookie": "a=1; Path=/" },
    });
    const single = rawHeaders(one).filter((pair) => pair.n.toLowerCase() === "set-cookie");
    expect(single).toEqual([{ n: "set-cookie", v: "a=1; Path=/" }]);

    const headers = new Headers();
    headers.append("set-cookie", "a=1; Path=/");
    headers.append("set-cookie", "b=2; Path=/");
    const two = new Request("http://localhost/api/h/x", { headers });
    const pairList = rawHeaders(two).filter((pair) => pair.n.toLowerCase() === "set-cookie");
    expect(pairList).toEqual([
      { n: "set-cookie", v: "a=1; Path=/" },
      { n: "set-cookie", v: "b=2; Path=/" },
    ]);
  });
});
