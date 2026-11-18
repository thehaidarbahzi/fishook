import { mkdtempSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildSchema } from "./schema";
import { fileSlug, generateGo, generateTs, modelName } from "./codegen";

describe("model naming", () => {
  it("turns an event type into a Go or TS type name", () => {
    expect(modelName("payment.succeeded")).toBe("PaymentSucceeded");
    expect(modelName("pull_request")).toBe("PullRequest");
    expect(modelName("customer.address.updated")).toBe("CustomerAddressUpdated");
    expect(modelName("_unknown")).toBe("UnknownEvent");
    expect(modelName("2024.event")).toBe("Event2024Event");
  });

  it("slugs a file name", () => {
    expect(fileSlug("payment.succeeded")).toBe("payment-succeeded");
    expect(fileSlug("Payment Succeeded!")).toBe("payment-succeeded");
    expect(fileSlug("___")).toBe("event");
  });
});

describe("Go generation", () => {
  const doc = buildSchema([
    { id: "evt_1", amount: 12000, "user-id": 7, coupon: "SAVE", customer: { id: "c1" } },
    { id: "evt_2", amount: 5000, "user-id": 8, coupon: null, customer: { id: "c2" }, extra: "x" },
  ]);

  const code = generateGo(doc, "payment.succeeded");

  it("writes the sample header", () => {
    expect(code).toContain("// fishook · payment.succeeded · 2 samples");
    expect(code).toContain("// Generated from observed payloads");
  });

  it("keeps the original JSON key in the tag", () => {
    expect(code).toMatch(/UserID\s+int64\s+`json:"user-id"`/);
    expect(code).toMatch(/ID\s+string\s+`json:"id"`/);
  });

  it("uses a pointer for optional and nullable fields", () => {
    expect(code).toMatch(/Coupon\s+\*string\s+`json:"coupon"`/);
    expect(code).toMatch(/Extra\s+\*string\s+`json:"extra,omitempty"`/);
  });

  it("emits a nested struct", () => {
    expect(code).toContain("type PaymentSucceededCustomer struct {");
    expect(code).toMatch(/Customer\s+PaymentSucceededCustomer/);
  });

  it("uses json.RawMessage for a conflict and says how to import it", () => {
    const conflict = buildSchema([{ amount: 1 }, { amount: "free" }]);
    const out = generateGo(conflict, "payment.succeeded");
    expect(out).toMatch(/Amount\s+json\.RawMessage/);
    expect(out).toContain("// conflict: int, string");
    expect(out).toContain('// Requires: import "encoding/json"');
  });

  it("handles an empty array", () => {
    const empty = buildSchema([{ tags: [] }]);
    const out = generateGo(empty, "payment.succeeded");
    expect(out).toMatch(/Tags\s+\[\]json\.RawMessage/);
    expect(out).toContain("// incomplete array");
  });

  it("handles an array of objects", () => {
    const array = buildSchema([{ items: [{ sku: "a" }] }]);
    const out = generateGo(array, "payment.succeeded");
    expect(out).toContain("type PaymentSucceededItemsItem struct {");
    expect(out).toMatch(/Items\s+\[\]PaymentSucceededItemsItem/);
  });

  it("dedupes identical nested shapes", () => {
    const dedupe = buildSchema([
      { left: { id: "a" }, right: { id: "b" } },
    ]);
    const out = generateGo(dedupe, "shape");
    const matches = out.match(/type Shape(?:Left|Right) struct/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(out).toMatch(/\*?Shape(Left|Right)/);
  });

  it("quotes a key that contains a backtick", () => {
    const weird = buildSchema([{ "a`b": 1 }]);
    const out = generateGo(weird, "weird");
    expect(out).toContain('json:\\"a`b\\"');
  });
});

describe("TypeScript generation", () => {
  it("uses optional and nullable syntax", () => {
    const doc = buildSchema([
      { id: "a", coupon: null },
      { id: "b", coupon: "SAVE", extra: "x" },
    ]);
    const code = generateTs(doc, "payment.succeeded");
    expect(code).toContain("export interface PaymentSucceeded {");
    expect(code).toContain("coupon: string | null;");
    expect(code).toContain("extra?: string;");
  });

  it("turns a conflict into a union", () => {
    const doc = buildSchema([{ amount: 1 }, { amount: "free" }]);
    const code = generateTs(doc, "payment.succeeded");
    expect(code).toContain("amount: number | string;");
    expect(code).toContain("conflict: int, string");
  });

  it("quotes a property that is not an identifier", () => {
    const doc = buildSchema([{ "first name": "Ada", "1st": true }]);
    const code = generateTs(doc, "person.updated");
    expect(code).toContain('"first name": string;');
    expect(code).toContain('"1st": boolean;');
  });

  it("handles a root array", () => {
    const doc = buildSchema([[{ id: "a" }, { id: "b" }]]);
    const code = generateTs(doc, "batch");
    expect(code).toContain("export type Batch = BatchItem[];");
  });
});

describe("generated code compiles", () => {
  const doc = buildSchema([
    {
      id: "evt_1",
      amount: 12000.5,
      note: "ok",
      coupon: null,
      tags: [],
      items: [{ sku: "a" }],
      customer: { id: "c1", address: { city: "Jakarta" } },
    },
    {
      id: "evt_2",
      amount: "free",
      tags: ["x"],
      items: [{ sku: "b", qty: 2 }],
      customer: { id: "c2", address: { city: "Bandung", zip: "40111" } },
      "user-id": 7,
    },
  ]);

  const goCode = generateGo(doc, "payment.succeeded");
  const tsCode = generateTs(doc, "payment.succeeded");
  const sample = '{"id":"evt_1","amount":12000.5,"note":"ok","tags":[],"items":[{"sku":"a"}]}';

  it("compiles with go build", () => {
    const hasGo = spawnSync("go", ["version"], { stdio: "ignore" }).status === 0;
    if (!hasGo) return;

    const dir = mkdtempSync(path.join(tmpdir(), "fishook-go-"));
    writeFileSync(
      path.join(dir, "go.mod"),
      "module fishooktest\n\ngo 1.22\n",
      "utf8",
    );
    writeFileSync(
      path.join(dir, "main.go"),
      [
        "package main",
        "",
        'import (',
        '  "encoding/json"',
        '  "fmt"',
        ")",
        "",
        goCode,
        "",
        "func main() {",
        "  var value PaymentSucceeded",
        "  if err := json.Unmarshal([]byte(`" + sample + "`), &value); err != nil {",
        "    panic(err)",
        "  }",
        '  fmt.Println(value.ID)',
        "}",
        "",
      ].join("\n"),
      "utf8",
    );

    const env = {
      ...process.env,
      GOCACHE: path.join(dir, ".gocache"),
      GOFLAGS: "-mod=mod",
    };
    const result = spawnSync("go", ["build", "./..."], {
      cwd: dir,
      env,
      encoding: "utf8",
    });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  }, 60_000);

  it("type-checks with tsc", () => {
    const tsc = path.join(process.cwd(), "node_modules", "typescript", "bin", "tsc");
    if (!existsSync(tsc)) return;

    const dir = mkdtempSync(path.join(tmpdir(), "fishook-ts-"));
    writeFileSync(
      path.join(dir, "sample.ts"),
      `${tsCode}\n\nexport const sample: PaymentSucceeded = {} as PaymentSucceeded;\n`,
      "utf8",
    );

    const result = spawnSync(
      process.execPath,
      [
        tsc,
        "--noEmit",
        "--strict",
        "--skipLibCheck",
        "--target",
        "ES2022",
        "--module",
        "ESNext",
        "--moduleResolution",
        "Bundler",
        path.join(dir, "sample.ts"),
      ],
      { cwd: dir, encoding: "utf8" },
    );
    expect(result.stdout).toBe("");
    expect(result.status).toBe(0);
  }, 30_000);
});
