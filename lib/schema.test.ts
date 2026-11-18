import { describe, expect, it } from "vitest";
import {
  buildSchema,
  findFirstConflict,
  flattenTree,
  isConflict,
  isNullable,
  isOptional,
  typeLabel,
} from "./schema";

describe("schema inference", () => {
  it("marks a field missing from some samples as optional", () => {
    const doc = buildSchema([{ id: "a" }, { id: "b", coupon: "SAVE" }]);
    const coupon = doc.root.fields.coupon;
    expect(isOptional(coupon, doc.root)).toBe(true);
    expect(isNullable(coupon)).toBe(false);
    expect(coupon.present).toBe(1);
    expect(doc.root.count).toBe(2);
  });

  it("marks a field that is null in some samples as nullable", () => {
    const doc = buildSchema([{ amount: null }, { amount: 10 }]);
    const amount = doc.root.fields.amount;
    expect(isNullable(amount)).toBe(true);
    expect(isOptional(amount, doc.root)).toBe(false);
    expect(typeLabel(amount.node)).toBe("int");
  });

  it("widens int and float without calling it a conflict", () => {
    const doc = buildSchema([{ amount: 1 }, { amount: 1.5 }]);
    expect(doc.root.fields.amount.node.kinds).toEqual(["number"]);
    expect(isConflict(doc.root.fields.amount.node)).toBe(false);
    expect(doc.conflicts).toBe(0);
  });

  it("records a conflict when types disagree", () => {
    const doc = buildSchema([{ amount: 1 }, { amount: "free" }]);
    const amount = doc.root.fields.amount;
    expect(isConflict(amount.node)).toBe(true);
    expect(doc.conflicts).toBe(1);
    expect(findFirstConflict(doc)).toBe("amount");
  });

  it("counts nested conflicts", () => {
    const doc = buildSchema([
      { customer: { id: 1 } },
      { customer: { id: "cus_1" } },
    ]);
    expect(doc.conflicts).toBe(1);
    expect(findFirstConflict(doc)).toBe("id");
  });

  it("merges array element schemas", () => {
    const doc = buildSchema([
      { items: [{ sku: "a" }, { sku: "b", qty: 2 }] },
      { items: [{ sku: "c" }] },
    ]);
    const items = doc.root.fields.items.node;
    expect(items.kinds).toEqual(["array"]);
    expect(items.element?.count).toBe(3);
    expect(items.element?.fields.qty.present).toBe(1);
  });

  it("flags an empty array as incomplete", () => {
    const doc = buildSchema([{ tags: [] }]);
    expect(doc.root.fields.tags.node.incompleteArray).toBe(true);
    expect(doc.warnings).toContain("incomplete_array");
  });

  it("flags integers above 2^53", () => {
    const doc = buildSchema([{ big: 9007199254740993 }]);
    expect(doc.root.fields.big.node.precisionRisk).toBe(true);
    expect(doc.warnings).toContain("precision_risk");
  });

  it("keeps objects deeper than the limit opaque", () => {
    let value: Record<string, unknown> = { leaf: "x" };
    for (let index = 0; index < 10; index += 1) value = { next: value };
    const doc = buildSchema([value]);
    let node = doc.root;
    for (let index = 0; index < 8; index += 1) {
      node = node.fields.next.node;
    }
    expect(node.fields).toEqual({});
  });

  it("handles a root array", () => {
    const doc = buildSchema([[{ id: "a" }, { id: "b" }]]);
    expect(doc.root.kinds).toEqual(["array"]);
    expect(doc.root.element?.fields.id.present).toBe(2);
  });

  it("counts samples", () => {
    const doc = buildSchema([{}, {}, {}]);
    expect(doc.samples).toBe(3);
    expect(doc.root.count).toBe(3);
  });
});

describe("flattenTree", () => {
  it("walks nested objects and array elements with paths", () => {
    const doc = buildSchema([
      {
        customer: { address: { city: "Jakarta", zip: "10110" } },
        items: [{ sku: "a" }, { sku: "b", qty: 2 }],
      },
    ]);
    const rows = flattenTree(doc);
    const paths = rows.map((row) => row.path);
    expect(paths).toContain("customer");
    expect(paths).toContain("customer.address.city");
    expect(paths).toContain("items");
    expect(paths).toContain("items[].sku");
    expect(paths).toContain("items[].qty");

    const qty = rows.find((row) => row.path === "items[].qty");
    expect(qty?.optional).toBe(true);
    expect(qty?.parentCount).toBe(2);
  });
});
