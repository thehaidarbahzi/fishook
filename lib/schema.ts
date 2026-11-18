import type { SchemaDoc, SchemaField, SchemaNode, TypeKind } from "./types";

const MAX_DEPTH = 8;

function emptyNode(): SchemaNode {
  return {
    kinds: [],
    count: 0,
    nulls: 0,
    integerOnly: true,
    precisionRisk: false,
    incompleteArray: false,
    fields: {},
    element: null,
  };
}

function addKind(node: SchemaNode, kind: TypeKind) {
  if (!node.kinds.includes(kind)) node.kinds.push(kind);
}

export function observe(value: unknown, depth = 0): SchemaNode {
  const node = emptyNode();
  node.count = 1;

  if (value === null) {
    node.nulls = 1;
    return node;
  }

  if (typeof value === "string") {
    addKind(node, "string");
    return node;
  }

  if (typeof value === "boolean") {
    addKind(node, "boolean");
    return node;
  }

  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      node.precisionRisk = true;
      node.integerOnly = false;
      addKind(node, "number");
    } else if (Number.isInteger(value)) {
      addKind(node, "integer");
    } else {
      node.integerOnly = false;
      addKind(node, "number");
    }
    return node;
  }

  if (Array.isArray(value)) {
    addKind(node, "array");
    if (value.length === 0) {
      node.incompleteArray = true;
      return node;
    }
    let element: SchemaNode | null = null;
    for (const item of value) {
      const next = observe(item, depth + 1);
      element = element ? mergeNodes(element, next) : next;
    }
    node.element = element;
    return node;
  }

  if (typeof value === "object") {
    addKind(node, "object");
    // Objects deeper than the limit stay opaque, so codegen emits an escape
    // hatch instead of inventing a type it cannot see.
    if (depth >= MAX_DEPTH) return node;
    const record = value as Record<string, unknown>;
    for (const [key, child] of Object.entries(record)) {
      node.fields[key] = {
        node: observe(child, depth + 1),
        present: 1,
        nulls: child === null ? 1 : 0,
      };
    }
    return node;
  }

  addKind(node, "unknown");
  return node;
}

function mergeKinds(a: TypeKind[], b: TypeKind[]): TypeKind[] {
  const merged: TypeKind[] = [];
  for (const kind of [...a, ...b]) {
    if (!merged.includes(kind)) merged.push(kind);
  }
  if (merged.includes("number")) {
    const index = merged.indexOf("integer");
    if (index >= 0) merged.splice(index, 1);
  }
  if (merged.includes("unknown") && merged.length > 1) {
    merged.splice(merged.indexOf("unknown"), 1);
  }
  return merged;
}

export function mergeNodes(a: SchemaNode, b: SchemaNode): SchemaNode {
  const node = emptyNode();
  node.kinds = mergeKinds(a.kinds, b.kinds);
  node.count = a.count + b.count;
  node.nulls = a.nulls + b.nulls;
  node.integerOnly = a.integerOnly && b.integerOnly;
  node.precisionRisk = a.precisionRisk || b.precisionRisk;
  node.incompleteArray = a.incompleteArray || b.incompleteArray;

  const fields: Record<string, SchemaField> = {};
  const keys = new Set([...Object.keys(a.fields), ...Object.keys(b.fields)]);
  for (const key of keys) {
    const left = a.fields[key];
    const right = b.fields[key];
    if (left && right) {
      fields[key] = {
        node: mergeNodes(left.node, right.node),
        present: left.present + right.present,
        nulls: left.nulls + right.nulls,
      };
    } else if (left) {
      fields[key] = { node: left.node, present: left.present, nulls: left.nulls };
    } else if (right) {
      fields[key] = { node: right.node, present: right.present, nulls: right.nulls };
    }
  }
  node.fields = fields;

  if (a.element && b.element) node.element = mergeNodes(a.element, b.element);
  else if (a.element) node.element = a.element;
  else if (b.element) node.element = b.element;

  return node;
}

export function isConflict(node: SchemaNode): boolean {
  return node.kinds.length > 1;
}

function walkConflicts(node: SchemaNode, seen = new Set<SchemaNode>()): number {
  if (seen.has(node)) return 0;
  seen.add(node);
  let count = isConflict(node) ? 1 : 0;
  for (const field of Object.values(node.fields)) {
    count += walkConflicts(field.node, seen);
  }
  if (node.element) count += walkConflicts(node.element, seen);
  return count;
}

export function buildSchema(values: unknown[], now = new Date()): SchemaDoc {
  let root: SchemaNode | null = null;
  for (const value of values) {
    const observed = observe(value);
    root = root ? mergeNodes(root, observed) : observed;
  }

  const doc: SchemaDoc = {
    root: root ?? emptyNode(),
    samples: values.length,
    conflicts: 0,
    warnings: [],
    updatedAt: now.toISOString(),
  };

  doc.conflicts = walkConflicts(doc.root);

  if (containsIncompleteArray(doc.root, new Set())) doc.warnings.push("incomplete_array");
  if (containsPrecisionRisk(doc.root, new Set())) doc.warnings.push("precision_risk");

  return doc;
}

function containsIncompleteArray(node: SchemaNode, seen: Set<SchemaNode>): boolean {
  if (seen.has(node)) return false;
  seen.add(node);
  if (node.incompleteArray) return true;
  for (const field of Object.values(node.fields)) {
    if (containsIncompleteArray(field.node, seen)) return true;
  }
  return node.element ? containsIncompleteArray(node.element, seen) : false;
}

function containsPrecisionRisk(node: SchemaNode, seen: Set<SchemaNode>): boolean {
  if (seen.has(node)) return false;
  seen.add(node);
  if (node.precisionRisk) return true;
  for (const field of Object.values(node.fields)) {
    if (containsPrecisionRisk(field.node, seen)) return true;
  }
  return node.element ? containsPrecisionRisk(node.element, seen) : false;
}

export function typeLabel(node: SchemaNode): string {
  if (isConflict(node)) return node.kinds.map(kindLabel).join(" | ");
  if (node.kinds.length === 0) {
    return node.nulls > 0 ? "null" : "unknown";
  }
  return kindLabel(node.kinds[0]);
}

export function kindLabel(kind: TypeKind): string {
  switch (kind) {
    case "integer":
      return "int";
    case "number":
      return "float";
    case "boolean":
      return "bool";
    default:
      return kind;
  }
}

export function isOptional(field: SchemaField, parent: SchemaNode): boolean {
  return field.present < parent.count;
}

export function isNullable(field: SchemaField): boolean {
  return field.nulls > 0;
}

export function conflictLabels(node: SchemaNode): string[] {
  return node.kinds.map(kindLabel);
}

export interface TreeRow {
  path: string;
  key: string;
  depth: number;
  node: SchemaNode;
  present: number;
  parentCount: number;
  optional: boolean;
  nullable: boolean;
  conflicts: boolean;
}

export function flattenTree(doc: SchemaDoc): TreeRow[] {
  const rows: TreeRow[] = [];

  function walk(fields: Record<string, SchemaField>, parent: SchemaNode, depth: number, prefix: string) {
    for (const [key, field] of Object.entries(fields)) {
      const path = prefix ? `${prefix}.${key}` : key;
      rows.push({
        path,
        key,
        depth,
        node: field.node,
        present: field.present,
        parentCount: parent.count,
        optional: isOptional(field, parent),
        nullable: field.nulls > 0,
        conflicts: isConflict(field.node),
      });
      if (field.node.kinds.includes("object")) {
        walk(field.node.fields, field.node, depth + 1, path);
      }
      if (field.node.kinds.includes("array") && field.node.element) {
        const element = field.node.element;
        if (element.kinds.includes("object")) {
          walk(element.fields, element, depth + 1, `${path}[]`);
        }
      }
    }
  }

  if (doc.root.kinds.includes("object")) {
    walk(doc.root.fields, doc.root, 0, "");
  } else if (doc.root.kinds.includes("array") && doc.root.element?.kinds.includes("object")) {
    walk(doc.root.element.fields, doc.root.element, 0, "[]");
  }

  return rows;
}

export function findFirstConflict(doc: SchemaDoc): string | null {
  const row = flattenTree(doc).find((entry) => entry.conflicts);
  return row ? row.key : null;
}
