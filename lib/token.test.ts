import { describe, expect, it } from "vitest";
import { hashToken, newToken, signSession, tokenTail, verifySession } from "./token";

describe("write token", () => {
  it("is 128 bits encoded as base64url", () => {
    const token = newToken();
    expect(token).toHaveLength(22);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(16);
  });

  it("does not repeat across many calls", () => {
    const tokens = new Set(Array.from({ length: 500 }, () => newToken()));
    expect(tokens.size).toBe(500);
  });

  it("hashes to a stable SHA-256 and keeps the last four characters", () => {
    const token = "abcdefghijklmnopqrstuv";
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toBe(hashToken(`${token}x`));
    expect(tokenTail(token)).toBe("stuv");
  });
});

describe("read cookie", () => {
  const payload = { endpointId: "6f1f2b4c-3f7a-4a2d-9b1e-7c0a1d2e3f40", token: "abc" };

  it("round-trips a payload", () => {
    const value = signSession(payload);
    expect(verifySession(value)).toEqual(payload);
  });

  it("rejects a tampered body", () => {
    const value = signSession(payload);
    const [body, mac] = value.split(".");
    const changed = `${body.slice(0, -1)}${body.endsWith("A") ? "B" : "A"}.${mac}`;
    expect(verifySession(changed)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const value = signSession(payload);
    expect(verifySession(`${value.slice(0, -1)}${value.endsWith("A") ? "B" : "A"}`)).toBeNull();
  });

  it("rejects missing, empty, and malformed values", () => {
    expect(verifySession(undefined)).toBeNull();
    expect(verifySession(null)).toBeNull();
    expect(verifySession("")).toBeNull();
    expect(verifySession("no-dot")).toBeNull();
    expect(verifySession(".mac")).toBeNull();
    expect(verifySession("body.")).toBeNull();
  });
});
