import type { SchemaDoc, SchemaField, SchemaNode } from "./types";
import { conflictLabels, isConflict, typeLabel } from "./schema";

const INITIALISMS = new Set([
  "id",
  "url",
  "uri",
  "api",
  "http",
  "https",
  "json",
  "xml",
  "ip",
  "uuid",
  "sha",
  "tls",
  "db",
  "sql",
  "html",
  "css",
]);

function words(input: string): string[] {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
}

export function modelName(eventType: string): string {
  if (!eventType || eventType === "_unknown") return "UnknownEvent";
  const parts = words(eventType);
  if (parts.length === 0) return "UnknownEvent";
  const name = parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
  return /^[0-9]/.test(name) ? `Event${name}` : name;
}

function goFieldName(key: string, used: Set<string>): string {
  const parts = words(key);
  let name = parts
    .map((part) => {
      const lower = part.toLowerCase();
      if (INITIALISMS.has(lower)) return lower.toUpperCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
  if (!name) name = "Field";
  if (/^[0-9]/.test(name)) name = `X${name}`;
  let candidate = name;
  let counter = 2;
  while (used.has(candidate)) {
    candidate = `${name}${counter}`;
    counter += 1;
  }
  used.add(candidate);
  return candidate;
}

function tsProperty(key: string): string {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) return key;
  return JSON.stringify(key);
}

function structHash(node: SchemaNode): string {
  const fields = Object.keys(node.fields)
    .sort()
    .map((key) => {
      const field = node.fields[key];
      return [key, structHash(field.node), field.present, field.nulls];
    });
  return JSON.stringify([
    [...node.kinds].sort(),
    fields,
    node.element ? structHash(node.element) : null,
    node.integerOnly,
    node.nulls > 0,
  ]);
}

interface GoContext {
  nested: string[];
  byHash: Map<string, string>;
  usedTypes: Set<string>;
}

interface GoField {
  name: string;
  type: string;
  tag: string;
  comments: string[];
}

function goTag(key: string, omitempty: boolean): string {
  const suffix = omitempty ? ",omitempty" : "";
  if (key.includes("`")) {
    const escaped = key.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"json:\\"${escaped}${suffix}\\""`;
  }
  return "`json:\"" + key + suffix + "\"`";
}

function hasRawMessage(node: SchemaNode): boolean {
  if (isConflict(node) || node.kinds.length === 0) return true;
  if (node.kinds.includes("unknown")) return true;
  if (node.kinds.includes("object") && Object.keys(node.fields).length === 0) return true;
  if (node.kinds.includes("array")) {
    if (!node.element) return true;
    return hasRawMessage(node.element);
  }
  return false;
}

function goBaseType(
  node: SchemaNode,
  parentName: string,
  fieldName: string,
  ctx: GoContext,
): string {
  if (isConflict(node) || node.kinds.length === 0) return "json.RawMessage";
  if (node.kinds.includes("unknown")) return "json.RawMessage";

  if (node.kinds.includes("object")) {
    if (Object.keys(node.fields).length === 0) return "json.RawMessage";
    return emitGoStruct(node, `${parentName}${fieldName}`, ctx);
  }

  if (node.kinds.includes("array")) {
    if (!node.element) return "[]json.RawMessage";
    if (isConflict(node.element) || node.element.kinds.length === 0) {
      return "[]json.RawMessage";
    }
    if (node.element.kinds.includes("object")) {
      return `[]${emitGoStruct(node.element, `${parentName}${fieldName}Item`, ctx)}`;
    }
    return `[]${goBaseType(node.element, parentName, `${fieldName}Item`, ctx)}`;
  }

  if (node.kinds.includes("boolean")) return "bool";
  if (node.kinds.includes("integer")) return "int64";
  if (node.kinds.includes("number")) return "float64";
  if (node.kinds.includes("string")) return "string";
  return "json.RawMessage";
}

function needsPointer(node: SchemaNode): boolean {
  if (isConflict(node) || node.kinds.length === 0) return false;
  if (node.kinds.includes("unknown")) return false;
  if (node.kinds.includes("array")) return false;
  if (node.kinds.includes("object")) return Object.keys(node.fields).length > 0;
  return true;
}

function emitGoStruct(node: SchemaNode, preferredName: string, ctx: GoContext): string {
  const hash = structHash(node);
  const existing = ctx.byHash.get(hash);
  if (existing) return existing;

  let name = preferredName;
  let counter = 2;
  while (ctx.usedTypes.has(name)) {
    name = `${preferredName}${counter}`;
    counter += 1;
  }
  ctx.usedTypes.add(name);
  ctx.byHash.set(hash, name);

  const usedFields = new Set<string>();
  const fields: GoField[] = [];

  for (const [key, field] of Object.entries(node.fields)) {
    const fieldName = goFieldName(key, usedFields);
    const optional = field.present < node.count;
    const nullable = field.nulls > 0;

    let type = goBaseType(field.node, name, fieldName, ctx);
    if (needsPointer(field.node) && (optional || nullable)) {
      type = `*${type}`;
    }
    if (isConflict(field.node) && optional) {
      type = "json.RawMessage";
    }

    const comments: string[] = [];
    if (optional) comments.push(`optional, ${field.present}/${node.count}`);
    if (nullable) comments.push("nullable");
    if (isConflict(field.node)) comments.push(`conflict: ${conflictLabels(field.node).join(", ")}`);
    if (field.node.incompleteArray) comments.push("incomplete array");
    if (field.node.precisionRisk) comments.push("precision risk above 2^53");
    if (field.node.kinds.includes("object") && Object.keys(field.node.fields).length === 0) {
      comments.push("free-form object");
    }
    if (field.node.kinds.length === 0 && field.node.nulls > 0) comments.push("always null");

    fields.push({
      name: fieldName,
      type,
      tag: goTag(key, optional),
      comments,
    });
  }

  const nameWidth = Math.max(0, ...fields.map((field) => field.name.length));
  const typeWidth = Math.max(0, ...fields.map((field) => field.type.length));
  const lines: string[] = [`type ${name} struct {`];
  if (fields.length === 0) {
    lines.push("}");
    ctx.nested.push(lines.join("\n"));
    return name;
  }
  for (const field of fields) {
    const left = field.name.padEnd(nameWidth, " ");
    const right = field.type.padEnd(typeWidth, " ");
    const comment = field.comments.length ? ` // ${field.comments.join(", ")}` : "";
    lines.push(`\t${left} ${right} ${field.tag}${comment}`.replace(/\s+$/, ""));
  }
  lines.push("}");
  ctx.nested.push(lines.join("\n"));
  return name;
}

function goHeader(doc: SchemaDoc, eventType: string): string[] {
  const lines = [
    `// fishook · ${eventType} · ${doc.samples} ${doc.samples === 1 ? "sample" : "samples"}${
      doc.conflicts ? ` · ${doc.conflicts} conflicts` : ""
    }`,
    "// Generated from observed payloads. Review before shipping.",
  ];
  if (doc.samples === 1) lines.push("// 1 sample. Optional fields can't be detected yet.");
  if (doc.conflicts > 0) {
    lines.push("// Conflict fields use json.RawMessage. Observed types are noted per field.");
  }
  if (doc.warnings.includes("incomplete_array")) {
    lines.push("// An empty array was observed. Its element type is not known.");
  }
  if (doc.warnings.includes("precision_risk")) {
    lines.push("// Integer values above 2^53 lose precision in JavaScript tooling.");
  }
  if (doc.warnings.includes("free_form")) {
    lines.push("// Some objects were too deep or had no observed keys.");
  }
  lines.push("// Go cannot tell a missing field from an explicit null with *T.");
  return lines;
}

export function generateGo(doc: SchemaDoc, eventType: string): string {
  const rootName = modelName(eventType);
  const ctx: GoContext = { nested: [], byHash: new Map(), usedTypes: new Set() };
  const header = goHeader(doc, eventType);
  let body: string;

  if (doc.root.kinds.includes("array")) {
    const element = doc.root.element;
    const elementType = element ? goBaseType(element, rootName, "Item", ctx) : "json.RawMessage";
    body = [...ctx.nested, `type ${rootName} = []${elementType}`].join("\n\n");
  } else if (
    !doc.root.kinds.includes("object") ||
    Object.keys(doc.root.fields).length === 0
  ) {
    body = `type ${rootName} = json.RawMessage`;
  } else {
    emitGoStruct(doc.root, rootName, ctx);
    body = ctx.nested.join("\n\n");
  }

  const code = [header.join("\n"), "", body].join("\n");
  const after = code.includes("json.RawMessage")
    ? [header.join("\n"), '// Requires: import "encoding/json"', "", body].join("\n")
    : code;
  return after;
}

interface TsContext {
  nested: string[];
  byHash: Map<string, string>;
  usedTypes: Set<string>;
}

function tsUnion(node: SchemaNode): string[] {
  return node.kinds.map((kind) => {
    switch (kind) {
      case "integer":
      case "number":
        return "number";
      case "string":
        return "string";
      case "boolean":
        return "boolean";
      case "object":
        return "Record<string, unknown>";
      case "array":
        return "unknown[]";
      default:
        return "unknown";
    }
  });
}

function emitTsInterface(node: SchemaNode, preferredName: string, ctx: TsContext): string {
  const hash = structHash(node);
  const existing = ctx.byHash.get(hash);
  if (existing) return existing;

  let name = preferredName;
  let counter = 2;
  while (ctx.usedTypes.has(name)) {
    name = `${preferredName}${counter}`;
    counter += 1;
  }
  ctx.usedTypes.add(name);
  ctx.byHash.set(hash, name);

  const fields: string[] = [];
  for (const [key, field] of Object.entries(node.fields)) {
    const optional = field.present < node.count;
    const nullable = field.nulls > 0;
    const property = tsProperty(key);

    let type: string;
    if (isConflict(field.node)) {
      type = tsUnion(field.node).join(" | ");
    } else if (field.node.kinds.length === 0) {
      type = "null";
    } else if (field.node.kinds.includes("unknown")) {
      type = "unknown";
    } else if (field.node.kinds.includes("object")) {
      type =
        Object.keys(field.node.fields).length === 0
          ? "Record<string, unknown>"
          : emitTsInterface(
              field.node,
              `${name}${goFieldName(key, new Set())}`,
              ctx,
            );
    } else if (field.node.kinds.includes("array")) {
      if (!field.node.element) {
        type = "unknown[]";
      } else if (isConflict(field.node.element)) {
        type = `(${tsUnion(field.node.element).join(" | ")})[]`;
      } else if (field.node.element.kinds.includes("object")) {
        const elementName = emitTsInterface(
          field.node.element,
          `${name}${goFieldName(key, new Set())}Item`,
          ctx,
        );
        type = `${elementName}[]`;
      } else {
        type = `${tsBaseType(field.node.element, name, key, ctx)}[]`;
      }
    } else {
      type = tsBaseType(field.node, name, key, ctx);
    }

    if (nullable) type = `${type} | null`;

    const comments: string[] = [];
    if (isConflict(field.node)) comments.push(`conflict: ${conflictLabels(field.node).join(", ")}`);
    if (field.node.incompleteArray) comments.push("incomplete array");
    if (field.node.precisionRisk) comments.push("precision risk above 2^53");
    if (field.node.kinds.includes("object") && Object.keys(field.node.fields).length === 0) {
      comments.push("free-form object");
    }
    if (field.node.kinds.length === 0 && field.node.nulls > 0) comments.push("always null");

    const comment = comments.length ? ` // ${comments.join(", ")}` : "";
    fields.push(`  ${property}${optional ? "?" : ""}: ${type};${comment}`);
  }

  const lines = [`export interface ${name} {`, ...fields, "}"];
  ctx.nested.push(lines.join("\n"));
  return name;
}

function tsBaseType(
  node: SchemaNode,
  parentName: string,
  fieldName: string,
  ctx: TsContext,
): string {
  if (isConflict(node)) return tsUnion(node).join(" | ");
  if (node.kinds.length === 0) return "null";
  if (node.kinds.includes("unknown")) return "unknown";
  if (node.kinds.includes("object")) {
    if (Object.keys(node.fields).length === 0) return "Record<string, unknown>";
    return emitTsInterface(node, `${parentName}${goFieldName(fieldName, new Set())}`, ctx);
  }
  if (node.kinds.includes("array")) {
    if (!node.element) return "unknown[]";
    return `${tsBaseType(node.element, parentName, `${fieldName}Item`, ctx)}[]`;
  }
  if (node.kinds.includes("boolean")) return "boolean";
  if (node.kinds.includes("integer") || node.kinds.includes("number")) return "number";
  if (node.kinds.includes("string")) return "string";
  return "unknown";
}

export function generateTs(doc: SchemaDoc, eventType: string): string {
  const rootName = modelName(eventType);
  const ctx: TsContext = { nested: [], byHash: new Map(), usedTypes: new Set() };
  const lines = [
    `// fishook · ${eventType} · ${doc.samples} ${doc.samples === 1 ? "sample" : "samples"}${
      doc.conflicts ? ` · ${doc.conflicts} conflicts` : ""
    }`,
    "// Generated from observed payloads. Review before shipping.",
  ];
  if (doc.samples === 1) lines.push("// 1 sample. Optional fields can't be detected yet.");
  if (doc.conflicts > 0) {
    lines.push("// Conflict fields are unions of every observed type.");
  }
  if (doc.warnings.includes("incomplete_array")) {
    lines.push("// An empty array was observed. Its element type is not known.");
  }
  if (doc.warnings.includes("precision_risk")) {
    lines.push("// Values above 2^53 lose precision when parsed as numbers.");
  }

  if (doc.root.kinds.includes("array")) {
    const element = doc.root.element;
    const elementType = element ? tsBaseType(element, rootName, "Item", ctx) : "unknown";
    const body = [...ctx.nested, `export type ${rootName} = ${elementType}[];`].join("\n\n");
    return [lines.join("\n"), "", body].join("\n");
  }

  if (!doc.root.kinds.includes("object") || Object.keys(doc.root.fields).length === 0) {
    lines.push(``);
    const fallback = doc.root.kinds.includes("object")
      ? "Record<string, unknown>"
      : tsBaseType(doc.root, rootName, "Root", ctx);
    lines.push(`export type ${rootName} = ${fallback};`);
    return lines.join("\n");
  }

  emitTsInterface(doc.root, rootName, ctx);
  lines.push(...ctx.nested);
  return lines.join("\n");
}

export function fileSlug(eventType: string): string {
  const slug = eventType
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "event";
}

export function describeRoot(doc: SchemaDoc): string {
  return typeLabel(doc.root);
}

export function fieldCount(doc: SchemaDoc): number {
  return Object.keys(doc.root.fields).length;
}

export type { SchemaField };
