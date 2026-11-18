"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { EventSummary, SchemaMap } from "@/lib/types";
import { fileSlug, generateGo, generateTs } from "@/lib/codegen";
import { flattenTree } from "@/lib/schema";
import { formatClock } from "@/lib/format";
import { CodeBlock } from "./CodeBlock";
import { CopyButton, selectNodeText } from "./CopyButton";
import { Icon } from "./Icon";
import { Tip } from "./Tooltip";

type Language = "go" | "ts";

export function CodePanel({
  schemas,
  events,
}: {
  schemas: SchemaMap;
  events: EventSummary[];
}) {
  const [language, setLanguage] = useState<Language>("go");
  const [eventType, setEventType] = useState<string>("");
  const codeRef = useRef<HTMLDivElement>(null);

  const eventTypes = useMemo(() => Object.keys(schemas).sort(), [schemas]);

  useEffect(() => {
    if (eventTypes.length === 0) {
      if (eventType !== "") setEventType("");
      return;
    }
    if (!eventTypes.includes(eventType)) setEventType(eventTypes[0]);
  }, [eventTypes, eventType]);

  const doc = eventType ? schemas[eventType] : undefined;

  const code = useMemo(() => {
    if (!doc) return "";
    return language === "go" ? generateGo(doc, eventType) : generateTs(doc, eventType);
  }, [doc, language, eventType]);

  const latest = useMemo(() => {
    if (!eventType) return null;
    const matches = events.filter((event) => event.eventType === eventType);
    return matches.length > 0 ? matches[0].receivedAt : null;
  }, [events, eventType]);

  const firstConflict = useMemo(() => {
    if (!doc) return null;
    return flattenTree(doc).find((row) => row.conflicts) ?? null;
  }, [doc]);

  function download() {
    if (!code) return;
    const extension = language === "go" ? "go" : "ts";
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${fileSlug(eventType)}.${extension}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function onTabKeys(event: React.KeyboardEvent) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = language === "go" ? "ts" : "go";
    setLanguage(next);
    const target = document.querySelector<HTMLButtonElement>(`[data-lang="${next}"]`);
    target?.focus();
  }

  return (
    <section aria-label="Generate" className="flex h-full min-h-0 flex-col bg-surface-0">
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-divider pl-2 pr-2">
        <div role="tablist" aria-label="Language" className="flex h-full items-stretch">
          {(["go", "ts"] as const).map((item) => {
            const active = language === item;
            return (
              <button
                key={item}
                type="button"
                role="tab"
                data-lang={item}
                aria-selected={active}
                aria-controls="code-view"
                id={`code-tab-${item}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setLanguage(item)}
                onKeyDown={onTabKeys}
                className={`relative h-full px-3 text-[13px] font-medium ${
                  active ? "text-text-1" : "text-text-2 hover:text-text-1"
                }`}
              >
                {item === "go" ? "Go" : "TypeScript"}
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-2 bottom-0 h-[2px] bg-primary"
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <div className="relative min-w-0">
            <label htmlFor="event-type" className="sr-only">
              Event type
            </label>
            <select
              id="event-type"
              value={eventType}
              onChange={(event) => setEventType(event.target.value)}
              disabled={eventTypes.length === 0}
              className="h-11 max-w-[190px] appearance-none truncate rounded-md border border-line bg-surface-2 pl-2 pr-7 text-[12px] text-text-1 disabled:cursor-not-allowed disabled:opacity-40 md:h-8"
            >
              {eventTypes.length === 0 ? <option value="">No event types</option> : null}
              {eventTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <Icon
              name="chevron"
              size={16}
              className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-text-2"
            />
          </div>

          <Tip label={`Download .${language}`}>
            <button
              type="button"
              onClick={download}
              disabled={!code}
              aria-label={`Download .${language} file`}
              className="inline-flex size-11 items-center justify-center rounded-md text-text-2 hover:bg-hover hover:text-text-1 disabled:cursor-not-allowed disabled:opacity-40 md:size-8"
            >
              <Icon name="download" size={18} />
            </button>
          </Tip>
        </div>
      </div>

      <div className="flex h-8 shrink-0 items-center justify-between gap-2 px-4">
        <p className="fk-nums truncate text-[12px] leading-[18px] text-text-3">
          {doc ? (
            <>
              {doc.samples} {doc.samples === 1 ? "sample" : "samples"}
              {doc.conflicts > 0 ? ` · ${doc.conflicts} ${doc.conflicts === 1 ? "conflict" : "conflicts"}` : ""}
              {latest ? (
                <>
                  {" · "}
                  <time dateTime={latest} suppressHydrationWarning>
                    {formatClock(latest)}
                  </time>
                </>
              ) : null}
            </>
          ) : (
            "No samples yet"
          )}
        </p>
        {doc ? (
          <span className="fk-micro shrink-0 text-text-3">{language === "go" ? "Go" : "TS"}</span>
        ) : null}
      </div>

      {doc && doc.samples === 1 ? (
        <div className="mx-4 mb-2 flex items-start gap-2 rounded-md border border-line bg-warning-tint px-3 py-2">
          <Icon name="warning" size={16} className="mt-0.5 shrink-0 text-warning" />
          <p className="text-[12px] leading-[18px] text-text-1">
            1 sample. Optional fields can&apos;t be detected yet.
          </p>
        </div>
      ) : null}

      {doc && firstConflict ? (
        <div className="mx-4 mb-2 flex items-start gap-2 rounded-md border border-line bg-conflict-tint px-3 py-2">
          <Icon name="warning" size={16} className="mt-0.5 shrink-0 text-conflict" />
          <p className="text-[12px] leading-[18px] text-text-1">
            {firstConflict.node.kinds.length} types observed for {firstConflict.path}. The
            generator emits an escape hatch.
          </p>
        </div>
      ) : null}

      {doc && (doc.warnings.includes("incomplete_array") || doc.warnings.includes("precision_risk")) ? (
        <div className="mx-4 mb-2 flex items-start gap-2 rounded-md border border-line bg-warning-tint px-3 py-2">
          <Icon name="warning" size={16} className="mt-0.5 shrink-0 text-warning" />
          <p className="text-[12px] leading-[18px] text-text-1">
            {doc.warnings.includes("incomplete_array")
              ? "An empty array was observed, so its element type is unknown."
              : null}
            {doc.warnings.includes("incomplete_array") && doc.warnings.includes("precision_risk")
              ? " "
              : null}
            {doc.warnings.includes("precision_risk")
              ? "An integer above 2^53 may lose precision in JavaScript."
              : null}
          </p>
        </div>
      ) : null}

      <div
        id="code-view"
        role="tabpanel"
        aria-labelledby={`code-tab-${language}`}
        ref={codeRef}
        className="min-h-0 flex-1 overflow-auto border-t border-divider"
      >
        {doc ? (
          <div key={`${eventType}-${language}-${doc.updatedAt}`} className="fk-fade min-h-full">
            <CodeBlock code={code} lang={language} className="min-h-full" />
          </div>
        ) : (
          <div className="flex flex-col gap-6 p-4">
            <div>
              <p className="text-[13px] font-medium leading-5 text-text-1">
                Waiting for the first payload
              </p>
              <p className="mt-1 max-w-[44ch] text-[12px] leading-[18px] text-text-2">
                The generator reads captured payloads. Send a test event to the URL above.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-t border-divider px-4">
        <span className="fk-mono-data min-w-0 flex-1 truncate text-[11px] text-text-3">
          {doc
            ? `updated ${formatClock(doc.updatedAt)}${doc.warnings.includes("incomplete_array") ? " · incomplete array" : ""}${doc.warnings.includes("precision_risk") ? " · precision risk" : ""}`
            : "No samples"}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <CopyButton
            text={code}
            variant="tonal"
            label="Copy"
            disabled={!code}
            selectOnError={() => selectNodeText(codeRef.current?.querySelector("code") ?? null)}
          />
          <button
            type="button"
            onClick={download}
            disabled={!doc}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-outline px-3 text-[13px] font-medium text-text-1 hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40 md:h-8"
          >
            <Icon name="download" size={16} />
            Download .{language}
          </button>
        </div>
      </div>
    </section>
  );
}
