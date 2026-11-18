import type { ReactNode } from "react";

type Lang = "go" | "ts" | "json";

const GO_KEYWORDS = new Set([
  "type",
  "struct",
  "map",
  "string",
  "int",
  "int64",
  "float64",
  "bool",
  "byte",
  "package",
  "import",
  "func",
  "var",
  "const",
  "return",
  "interface",
  "any",
]);

const TS_KEYWORDS = new Set([
  "export",
  "interface",
  "type",
  "const",
  "let",
  "function",
  "extends",
  "implements",
  "keyof",
  "typeof",
  "as",
  "null",
  "true",
  "false",
  "unknown",
  "string",
  "number",
  "boolean",
]);

const TOKEN =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][A-Za-z0-9_$]*)|([{}()[\];:,.<>=|&*?+\-/%!]+)|(\s+)/g;

function classify(lang: Lang, kind: string, value: string): string {
  if (kind === "comment") return "text-code-comment";
  if (kind === "string") return lang === "json" ? "text-code-string" : "text-code-string";
  if (kind === "number") return "text-code-number";
  if (kind === "punct") return "text-code-punctuation";

  if (lang === "json") {
    if (value === "true" || value === "false" || value === "null") return "text-code-keyword";
    return "text-text-1";
  }

  if (lang === "go") {
    if (GO_KEYWORDS.has(value)) {
      if (["string", "int64", "float64", "bool", "byte", "int"].includes(value)) {
        return "text-code-type";
      }
      return "text-code-keyword";
    }
    if (value === "json" || value === "RawMessage" || value === "Message") {
      return "text-code-type";
    }
    if (/^[A-Z]/.test(value)) return "text-code-type";
    return "text-text-1";
  }

  if (TS_KEYWORDS.has(value)) {
    if (value === "null" || value === "true" || value === "false") return "text-code-keyword";
    if (value === "string" || value === "number" || value === "boolean" || value === "unknown") {
      return "text-code-type";
    }
    return "text-code-keyword";
  }
  if (value === "Record" || value === "JSON" || /^[A-Z]/.test(value)) return "text-code-type";
  return "text-text-1";
}

function highlight(code: string, lang: Lang): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  TOKEN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = TOKEN.exec(code)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(code.slice(lastIndex, match.index));
    }

    const [raw, comment, str, num, word, punct, space] = match;
    let kind = "plain";
    if (comment) kind = "comment";
    else if (str) kind = "string";
    else if (num) kind = "number";
    else if (word) kind = "word";
    else if (punct) kind = "punct";
    else if (space) kind = "space";

    if (kind === "space" || kind === "plain") {
      nodes.push(raw);
    } else if (kind === "string" && lang === "json") {
      const rest = code.slice(match.index + raw.length);
      const isKey = /^\s*:/.test(rest);
      nodes.push(
        <span key={key++} className={isKey ? "text-text-1" : "text-code-string"}>
          {raw}
        </span>,
      );
    } else {
      nodes.push(
        <span key={key++} className={classify(lang, kind, raw)}>
          {raw}
        </span>,
      );
    }
    lastIndex = match.index + raw.length;
  }

  if (lastIndex < code.length) nodes.push(code.slice(lastIndex));
  return nodes;
}

export function CodeBlock({
  code,
  lang,
  className = "",
}: {
  code: string;
  lang: Lang;
  className?: string;
}) {
  return (
    <pre
      className={`fk-mono-code m-0 overflow-x-auto p-4 text-text-1 ${className}`}
      tabIndex={0}
      aria-label={`${lang === "json" ? "JSON" : lang === "go" ? "Go" : "TypeScript"} source`}
    >
      <code>{highlight(code, lang)}</code>
    </pre>
  );
}
