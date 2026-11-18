"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { useEffect, useMemo, useState } from "react";
import type { EventDetail, HeaderPair, SchemaDoc } from "@/lib/types";
import { flattenTree, typeLabel } from "@/lib/schema";
import { formatBytes, formatClock } from "@/lib/format";
import { CodeBlock } from "./CodeBlock";
import { CopyButton } from "./CopyButton";
import { Icon } from "./Icon";
import { Tip } from "./Tooltip";

const SENSITIVE = new Set(["authorization", "cookie", "set-cookie", "x-api-key"]);

function mask(value: string): string {
  const visible = value.length <= 4 ? "" : value.slice(-2);
  return `${"•".repeat(Math.min(12, Math.max(6, value.length - 2)))}${visible}`;
}

function decode(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function resolvePath(value: unknown, segments: string[]): unknown {
  if (segments.length === 0) return value;
  const [head, ...rest] = segments;
  if (head.endsWith("[]")) {
    const key = head.slice(0, -2);
    const target =
      key === ""
        ? value
        : value && typeof value === "object" && !Array.isArray(value)
          ? (value as Record<string, unknown>)[key]
          : undefined;
    if (!Array.isArray(target)) return undefined;
    return target.map((item) => resolvePath(item, rest));
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return resolvePath((value as Record<string, unknown>)[head], rest);
  }
  return undefined;
}

function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export function PayloadDrawer({
  open,
  onClose,
  onClosed,
  seq,
  detail,
  loading,
  error,
  schema,
  onRetry,
}: {
  open: boolean;
  onClose: () => void;
  onClosed: () => void;
  seq: number | null;
  detail: EventDetail | null;
  loading: boolean;
  error: string | null;
  schema: SchemaDoc | null;
  onRetry: () => void;
}) {
  const [tab, setTab] = useState("parsed");
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  useEffect(() => {
    setTab("parsed");
    setRevealed(new Set());
  }, [seq]);

  const rawText = useMemo(() => {
    if (!detail) return "";
    return new TextDecoder("utf-8", { fatal: false }).decode(decode(detail.rawBodyBase64));
  }, [detail]);

  const parsed = useMemo(() => {
    if (!detail) return { text: "", truncated: false };
    const pretty = prettyJson(rawText);
    if (pretty.length > 120_000) {
      return { text: pretty.slice(0, 120_000), truncated: true };
    }
    return { text: pretty, truncated: false };
  }, [detail, rawText]);

  const tree = useMemo(() => (schema ? flattenTree(schema) : []), [schema]);

  const payload = useMemo(() => {
    if (!detail) return undefined;
    try {
      return JSON.parse(rawText) as unknown;
    } catch {
      return undefined;
    }
  }, [detail, rawText]);

  const time = detail ? formatClock(detail.receivedAt) : "";
  const type = detail
    ? detail.eventType === "_unknown"
      ? "unknown event"
      : detail.eventType
    : "";

  return (
    <Dialog.Root open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <Dialog.Portal>
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 z-40 flex h-[92dvh] flex-col rounded-t-xl border-t border-outline bg-surface-3 shadow-[0_-12px_32px_rgba(0,0,0,0.40)] data-[state=closed]:animate-drawer-out data-[state=open]:animate-drawer-in md:h-[40vh] md:min-h-[280px] md:max-h-[480px] lg:h-[46vh]"
          aria-modal="true"
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onClosed();
          }}
        >
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-divider pl-2 pr-2 md:pl-4">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close detail"
              className="inline-flex size-11 items-center justify-center rounded-md text-text-2 hover:bg-hover hover:text-text-1 md:hidden"
            >
              <Icon name="back" size={20} />
            </button>
            <Dialog.Title className="min-w-0 flex-1 truncate text-[11px] leading-4 text-text-2">
              <span className="fk-micro">Detail</span>
              {detail ? (
                <>
                  <span className="mx-1.5 text-text-3">·</span>
                  <span className="fk-mono-data fk-nums text-[11px]">{time}</span>
                  <span className="mx-1.5 text-text-3">·</span>
                  <span className="text-[12px] text-text-1">{type}</span>
                </>
              ) : null}
            </Dialog.Title>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close detail"
              className="hidden size-8 items-center justify-center rounded-md text-text-2 hover:bg-hover hover:text-text-1 md:inline-flex"
            >
              <Icon name="close" size={18} />
            </button>
          </div>

          {loading ? (
            <div className="flex flex-1 flex-col gap-3 p-4">
              <div className="fk-skeleton h-3 w-[40%]" />
              <div className="fk-skeleton h-3 w-[70%]" />
              <div className="fk-skeleton h-3 w-[55%]" />
              <p className="mt-2 text-[12px] text-text-3">Loading payload</p>
            </div>
          ) : error || !detail ? (
            <div className="flex flex-1 flex-col items-start gap-3 p-4">
              <p className="text-[13px] font-medium text-text-1">Payload could not be loaded.</p>
              <p className="max-w-[52ch] text-[12px] leading-[18px] text-text-2">
                The event may have passed the 72 hour window. Reload the stream to check what is
                still stored.
              </p>
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex h-11 items-center gap-2 rounded-md border border-outline px-3 text-[13px] text-text-1 hover:bg-hover md:h-8"
              >
                <Icon name="refresh" size={16} />
                Retry
              </button>
            </div>
          ) : (
            <Tabs.Root
              value={tab}
              onValueChange={setTab}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-divider pr-3">
                <Tabs.List aria-label="Payload views" className="flex h-11 items-stretch md:h-9">
                  {[
                    ["parsed", "Parsed"],
                    ["raw", "Raw"],
                    ["headers", "Headers"],
                    ["tree", "Tree"],
                  ].map(([value, label]) => (
                    <Tabs.Trigger
                      key={value}
                      value={value}
                      className="relative px-3 text-[12px] font-medium text-text-2 data-[state=active]:text-text-1"
                    >
                      {label}
                      {tab === value ? (
                        <span
                          aria-hidden="true"
                          className="absolute inset-x-2 bottom-0 h-[2px] bg-primary"
                        />
                      ) : null}
                    </Tabs.Trigger>
                  ))}
                </Tabs.List>
                <CopyButton
                  text={rawText}
                  label="Copy"
                  ariaLabel="Copy payload"
                  variant="ghost"
                />
              </div>

              <Tabs.Content value="parsed" className="min-h-0 flex-1 overflow-auto">
                {parsed.truncated ? (
                  <p className="border-b border-divider bg-warning-tint px-4 py-2 text-[11px] leading-4 text-warning">
                    Preview truncated at 120 KB. Copy the payload for the full body.
                  </p>
                ) : null}
                <CodeBlock code={parsed.text} lang="json" />
              </Tabs.Content>

              <Tabs.Content value="raw" className="min-h-0 flex-1 overflow-auto">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-divider px-4 py-2 text-[11px] leading-4 text-text-3">
                  <span className="fk-mono-data">
                    {detail.method} {detail.path}
                    {detail.queryString ? `?${detail.queryString}` : ""}
                  </span>
                  <span className="fk-nums">{formatBytes(detail.bodySize)}</span>
                  <span className="fk-mono-data truncate">sha256 {detail.bodySha256.slice(0, 16)}…</span>
                  {detail.sourceIp ? <span className="fk-mono-data">{detail.sourceIp}</span> : null}
                </div>
                <pre className="fk-mono-data m-0 whitespace-pre p-4 text-text-1">{rawText}</pre>
                {rawText.includes("\uFFFD") ? (
                  <p className="border-t border-divider px-4 py-2 text-[11px] leading-4 text-warning">
                    Body is not valid UTF-8. Replacement characters are shown; the SHA-256 covers
                    the exact bytes.
                  </p>
                ) : null}
              </Tabs.Content>

              <Tabs.Content value="headers" className="min-h-0 flex-1 overflow-auto">
                <HeadersView headers={detail.headers} revealed={revealed} setRevealed={setRevealed} />
              </Tabs.Content>

              <Tabs.Content value="tree" className="min-h-0 flex-1 overflow-auto">
                {tree.length === 0 ? (
                  <p className="p-4 text-[12px] leading-[18px] text-text-2">
                    No schema yet. This payload did not produce a root object.
                  </p>
                ) : (
                  <ul role="list" className="py-1">
                    {tree.map((row) => {
                      const value = resolvePath(payload, row.path.split("."));
                      const present = value !== undefined;
                      const rendered = present
                        ? typeof value === "string"
                          ? value
                          : (JSON.stringify(value, null, 2) ?? "null")
                        : "";
                      return (
                        <li
                          key={row.path}
                          className="group flex min-h-11 items-center gap-2 border-b border-divider/60 py-1 pr-2 hover:bg-surface-4/60 md:min-h-7"
                          style={{ paddingLeft: 16 + row.depth * 16 }}
                        >
                          <span className="fk-mono-data shrink-0 text-text-1">{row.key}</span>
                          <span className="fk-mono-data min-w-0 flex-1 truncate text-text-2">
                            {typeLabel(row.node)}
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            {row.optional ? (
                              <span className="rounded-sm bg-optional/10 px-1 text-[10px] leading-4 text-optional">
                                optional · {row.present}/{row.parentCount}
                              </span>
                            ) : (
                              <span className="fk-nums text-[10px] leading-4 text-text-3">
                                {row.present}/{row.parentCount}
                              </span>
                            )}
                            {row.nullable ? (
                              <span className="rounded-sm bg-info-tint px-1 text-[10px] leading-4 text-info">
                                nullable
                              </span>
                            ) : null}
                            {row.conflicts ? (
                              <span className="rounded-sm bg-conflict-tint px-1 text-[10px] leading-4 text-conflict">
                                {row.node.kinds.length} types
                              </span>
                            ) : null}
                            {row.node.incompleteArray ? (
                              <span className="rounded-sm bg-warning-tint px-1 text-[10px] leading-4 text-warning">
                                empty array
                              </span>
                            ) : null}
                          </span>
                          {present ? (
                            <span className="shrink-0 opacity-100 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                              <Tip label={`Copy ${row.key}`}>
                                <CopyButton
                                  text={rendered}
                                  label=""
                                  ariaLabel={`Copy value for ${row.key}`}
                                  variant="ghost"
                                  className="!w-11 !px-0 md:!w-8"
                                />
                              </Tip>
                            </span>
                          ) : (
                            <span className="shrink-0 pr-2 text-[10px] leading-4 text-text-3">
                              not in payload
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Tabs.Content>
            </Tabs.Root>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function HeadersView({
  headers,
  revealed,
  setRevealed,
}: {
  headers: HeaderPair[];
  revealed: Set<string>;
  setRevealed: (next: Set<string>) => void;
}) {
  if (headers.length === 0) {
    return <p className="p-4 text-[12px] text-text-2">No headers captured.</p>;
  }

  return (
    <ul role="list" className="divide-y divide-divider">
      {headers.map((header, index) => {
        const sensitive = SENSITIVE.has(header.n.toLowerCase());
        const showing = revealed.has(`${header.n}:${index}`);
        const value = sensitive && !showing ? mask(header.v) : header.v;
        return (
          <li
            key={`${header.n}:${index}`}
            className="grid grid-cols-[minmax(90px,140px)_minmax(0,1fr)_auto] items-start gap-2 px-4 py-1.5"
          >
            <span className="fk-mono-data break-all text-text-3">{header.n}</span>
            <span className="fk-mono-data break-all text-text-1">{value}</span>
            <span className="flex items-center gap-1">
              {sensitive ? (
                <button
                  type="button"
                  aria-pressed={showing}
                  onClick={() => {
                    const next = new Set(revealed);
                    const key = `${header.n}:${index}`;
                    if (next.has(key)) next.delete(key);
                    else next.add(key);
                    setRevealed(next);
                  }}
                  className="inline-flex size-11 items-center justify-center rounded-sm text-text-2 hover:bg-hover hover:text-text-1 md:size-8"
                  aria-label={`${showing ? "Hide" : "Reveal"} ${header.n}`}
                >
                  <Icon name={showing ? "eye_off" : "eye"} size={16} />
                </button>
              ) : null}
              <CopyButton
                text={header.v}
                label=""
                ariaLabel={`Copy ${header.n}`}
                variant="ghost"
                className="!w-11 !px-0 md:!w-8"
              />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
