"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { EventSummary } from "@/lib/types";
import { formatClock, prefersReducedMotion } from "@/lib/format";
import { Icon } from "./Icon";

export type ConnectionState = "connecting" | "live" | "paused" | "failed";

export function ConnectionBadge({ state }: { state: ConnectionState }) {
  const label =
    state === "live"
      ? "live"
      : state === "connecting"
        ? "connecting"
        : state === "paused"
          ? "paused"
          : "failed";
  const dot =
    state === "live"
      ? "bg-success"
      : state === "connecting"
        ? "bg-text-3"
        : state === "paused"
          ? "bg-warning"
          : "bg-error";

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] leading-4 text-text-2">
      <span aria-hidden="true" className={`size-1.5 rounded-full ${dot}`} />
      <span>{label}</span>
    </span>
  );
}

function isUnparseable(event: EventSummary): boolean {
  return event.parseStatus !== "ok" && event.parseStatus !== "root_not_object";
}

function Knot({
  event,
  selected,
  newest,
  animate,
}: {
  event: EventSummary;
  selected: boolean;
  newest: boolean;
  animate: boolean;
}) {
  const unparseable = isUnparseable(event);
  const duplicate = event.isDuplicate;
  const shape = unparseable
    ? "rounded-none bg-error"
    : duplicate
      ? "rounded-full border border-text-3 bg-surface-0"
      : "rounded-full bg-primary";
  return (
    <span
      aria-hidden="true"
      className={`relative block size-2 ${shape} ${selected ? "outline outline-2 outline-offset-2 outline-primary" : ""} ${
        newest && animate ? "fk-knot-pulse" : ""
      }`}
    />
  );
}

export function CatchStream({
  events,
  selectedSeq,
  onSelect,
  pendingCount,
  onJumpTop,
  connection,
  initialMaxSeq,
  empty,
  onAtTopChange,
}: {
  events: EventSummary[];
  selectedSeq: number | null;
  onSelect: (event: EventSummary) => void;
  pendingCount: number;
  onJumpTop: () => void;
  connection: ConnectionState;
  initialMaxSeq: number;
  empty: ReactNode;
  onAtTopChange?: (atTop: boolean) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const atTop = useRef(true);
  const lastHeadSeq = useRef(initialMaxSeq);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const head = events[0]?.seq ?? 0;
    if (pendingCount > 0) {
      setAnnouncement(`${pendingCount} new ${pendingCount === 1 ? "event" : "events"}`);
      return;
    }
    if (head > lastHeadSeq.current) {
      const added = events.filter((event) => event.seq > lastHeadSeq.current).length;
      if (added > 0) {
        setAnnouncement(`${added} new ${added === 1 ? "event" : "events"} received`);
      }
    }
    lastHeadSeq.current = Math.max(lastHeadSeq.current, head);
  }, [events, pendingCount]);

  function handleScroll() {
    const node = scrollRef.current;
    if (!node) return;
    const next = node.scrollTop < 8;
    if (next !== atTop.current) {
      atTop.current = next;
      onAtTopChange?.(next);
    }
  }

  function jump() {
    onJumpTop();
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: 0,
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    });
  }

  const maxSeq = events.length > 0 ? events[0].seq : 0;

  return (
    <section aria-label="Catch" className="flex h-full min-h-0 flex-col bg-surface-1">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-divider px-4">
        <span className="fk-micro text-text-3">Catch</span>
        <div className="flex items-center gap-3">
          <span className="fk-nums text-[11px] leading-4 text-text-3">
            {events.length} {events.length === 1 ? "event" : "events"}
          </span>
          <ConnectionBadge state={connection} />
        </div>
      </div>

      <div className="sr-only" role="log" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <div className="relative min-h-0 flex-1">
        {pendingCount > 0 ? (
          <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center">
            <button
              type="button"
              onClick={jump}
              className="pointer-events-auto inline-flex h-8 items-center gap-1.5 rounded-full border border-outline bg-surface-3 px-3 text-[12px] font-medium text-text-1 shadow-[0_8px_24px_rgba(0,0,0,0.35)] hover:bg-surface-4"
            >
              <Icon name="refresh" size={14} />
              {pendingCount} new {pendingCount === 1 ? "event" : "events"}
            </button>
          </div>
        ) : null}

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto overscroll-contain"
        >
          {events.length === 0 ? (
            <div className="fk-net relative flex min-h-full flex-col justify-center px-6 py-12">
              <span
                aria-hidden="true"
                className="absolute bottom-0 left-[80px] top-0 w-[2px] -translate-x-1/2 border-l-2 border-dashed border-outline opacity-40"
              />
              {empty}
            </div>
          ) : (
            <div className="relative py-1">
              <span
                aria-hidden="true"
                className="absolute bottom-1 left-[80px] top-1 w-[2px] -translate-x-1/2 bg-outline"
              />
              <ul role="list">
                {events.map((event) => {
                const selected = event.seq === selectedSeq;
                const displayType = event.eventType === "_unknown" ? "unknown event" : event.eventType;
                const time = formatClock(event.receivedAt);
                const unparseable = isUnparseable(event);
                const label = `${displayType} at ${time}${event.isDuplicate ? ", duplicate" : ""}${
                  unparseable ? ", unparseable" : ""
                }${event.parseStatus === "root_not_object" ? ", root is not an object" : ""}`;

                return (
                  <li key={event.seq}>
                    <button
                      type="button"
                      data-seq={event.seq}
                      aria-current={selected ? "true" : undefined}
                      aria-label={label}
                      onClick={() => onSelect(event)}
                      className={`relative grid h-9 w-full grid-cols-[64px_32px_minmax(0,1fr)_auto] items-center text-left transition-colors duration-100 ${
                        selected ? "bg-surface-4" : "hover:bg-surface-2"
                      } ${event.seq > initialMaxSeq ? "animate-row-in" : ""}`}
                    >
                      <time
                        dateTime={event.receivedAt}
                        suppressHydrationWarning
                        className="fk-mono-data fk-nums pr-1 text-right text-[11px] leading-4 text-text-3"
                      >
                        {time}
                      </time>
                      <span className="flex h-full items-center justify-center">
                        <Knot
                          event={event}
                          selected={selected}
                          newest={event.seq === maxSeq}
                          animate={maxSeq > initialMaxSeq}
                        />
                      </span>
                      <span className="min-w-0 pl-2">
                        <span className="block truncate text-[13px] font-medium leading-5 text-text-1">
                          {displayType}
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5 pl-2 pr-3">
                        {event.isDuplicate ? (
                          <span className="rounded-full border border-outline px-1.5 text-[10px] leading-4 text-text-3">
                            dup
                          </span>
                        ) : null}
                        {unparseable ? (
                          <span className="text-[11px] leading-4 text-error">unparseable</span>
                        ) : null}
                        {event.parseStatus === "root_not_object" ? (
                          <span className="text-[11px] leading-4 text-warning">root array</span>
                        ) : null}
                        {event.method !== "POST" ? (
                          <span className="fk-mono-data text-[10px] uppercase leading-4 text-text-3">
                            {event.method}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
