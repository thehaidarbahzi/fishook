"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EventDetail, EventSummary, SchemaMap } from "@/lib/types";
import { formatBytes, formatClock } from "@/lib/format";
import { site } from "@/lib/site";
import { LogoLink } from "./Logo";
import { GitHubIcon } from "./Icon";
import { CopyButton, selectNodeText } from "./CopyButton";
import { CatchStream, type ConnectionState } from "./CatchStream";
import { CodePanel } from "./CodePanel";
import { PayloadDrawer } from "./PayloadDrawer";
import { EndpointMenu } from "./EndpointMenu";
import { RotateUrlButton } from "./RotateUrlButton";
import { ToastProvider } from "./Toast";
import { Tip } from "./Tooltip";

type MobileTab = "stream" | "generate" | "detail";

export function AppShell({
  initialUrl,
  tokenTail,
  initialEvents,
  initialSchemas,
  initialCount,
  initialRejected,
}: {
  initialUrl: string;
  tokenTail: string;
  initialEvents: EventSummary[];
  initialSchemas: SchemaMap;
  initialCount: number;
  initialRejected: number;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [tail, setTail] = useState(tokenTail);
  const [events, setEvents] = useState<EventSummary[]>(initialEvents);
  const [pending, setPending] = useState<EventSummary[]>([]);
  const [schemas, setSchemas] = useState<SchemaMap>(initialSchemas);
  const [count, setCount] = useState(initialCount);
  const [rejected, setRejected] = useState(initialRejected);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [mobileTab, setMobileTab] = useState<MobileTab>("stream");

  const [selectedSeq, setSelectedSeq] = useState<number | null>(null);
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const urlRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const atTopRef = useRef(true);
  const maxSeqRef = useRef(initialEvents[0]?.seq ?? 0);
  const seenRef = useRef(new Set(initialEvents.map((event) => event.seq)));
  const requestSeqRef = useRef(0);

  useEffect(() => {
    // Sliding expiry for the read cookie. Failure is non-fatal: the existing
    // cookie keeps working until its current Max-Age runs out.
    void fetch("/api/session/refresh", {
      method: "POST",
      cache: "no-store",
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const source = new EventSource(`/app/stream?after=${maxSeqRef.current}`);

    source.onopen = () => setConnection("live");
    source.onerror = () => setConnection("paused");

    source.onmessage = (message) => {
      let event: EventSummary;
      try {
        event = JSON.parse(message.data) as EventSummary;
      } catch {
        return;
      }
      if (!event || typeof event.seq !== "number" || seenRef.current.has(event.seq)) return;
      seenRef.current.add(event.seq);
      maxSeqRef.current = Math.max(maxSeqRef.current, event.seq);
      setCount((value) => Math.min(2000, value + 1));

      if (atTopRef.current) {
        setEvents((previous) => [event, ...previous].slice(0, 2000));
      } else {
        setPending((previous) => [event, ...previous].slice(0, 2000));
      }
    };

    source.addEventListener("schemas", (message) => {
      try {
        setSchemas(JSON.parse((message as MessageEvent).data) as SchemaMap);
      } catch {
        // A malformed schema frame is skipped; the next one replaces it.
      }
    });

    source.addEventListener("end", () => setConnection("paused"));

    return () => source.close();
  }, []);

  const loadDetail = useCallback(async (seq: number) => {
    requestSeqRef.current += 1;
    const requestId = requestSeqRef.current;
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);
    try {
      const response = await fetch(`/api/events/${seq}`, { cache: "no-store" });
      if (!response.ok) throw new Error("load failed");
      const data = (await response.json()) as { event: EventDetail };
      if (requestSeqRef.current === requestId) setDetail(data.event);
    } catch {
      if (requestSeqRef.current === requestId) setDetailError("failed");
    } finally {
      if (requestSeqRef.current === requestId) setDetailLoading(false);
    }
  }, []);

  function rememberOpener() {
    const active = document.activeElement;
    openerRef.current = active instanceof HTMLElement ? active : null;
  }

  function openDetail(event: EventSummary) {
    rememberOpener();
    setSelectedSeq(event.seq);
    setDrawerOpen(true);
    void loadDetail(event.seq);
  }

  function openSelected() {
    if (selectedSeq === null) return;
    rememberOpener();
    setDrawerOpen(true);
    if (!detail) void loadDetail(selectedSeq);
  }

  function focusAfterDrawer() {
    const opener = openerRef.current;
    openerRef.current = null;
    requestAnimationFrame(() => {
      if (opener && opener.isConnected && opener.getClientRects().length > 0) {
        opener.focus();
        return;
      }
      const row =
        selectedSeq === null
          ? null
          : document.querySelector<HTMLElement>(`[data-seq="${selectedSeq}"]`);
      if (row) {
        row.focus();
        return;
      }
      document.querySelector<HTMLElement>('[aria-label="Views"] button')?.focus();
    });
  }

  function jumpToTop() {
    setEvents((previous) => [...pending, ...previous].slice(0, 2000));
    setPending([]);
  }

  function onRotated(nextUrl: string, nextTail: string) {
    setUrl(nextUrl);
    setTail(nextTail);
  }

  function onDeleted() {
    window.location.assign("/app");
  }

  const selectedEvent = useMemo(
    () => events.find((event) => event.seq === selectedSeq) ?? pending.find((event) => event.seq === selectedSeq) ?? null,
    [events, pending, selectedSeq],
  );

  const detailSchema = detail ? schemas[detail.eventType] ?? null : null;

  const emptyState = (
    <div className="max-w-[46ch]">
      <h2 className="fk-title text-text-1">Paste this URL into your provider</h2>
      <p className="mt-1 text-[13px] leading-[20px] text-text-2">
        Then trigger a test event. Payloads show up here.
      </p>

      <ol className="mt-6 flex flex-col gap-3">
        {[
          "Copy the webhook URL above.",
          "Paste it into the provider webhook settings.",
          "Trigger a test event. The first row lands in about a second.",
        ].map((step, index) => (
          <li key={step} className="flex gap-3">
            <span className="fk-mono-data fk-nums mt-0.5 text-[11px] text-text-3">
              0{index + 1}
            </span>
            <span className="text-[13px] leading-[20px] text-text-1">{step}</span>
          </li>
        ))}
      </ol>

      <div className="mt-6 border-t border-divider pt-4">
        <p className="fk-micro text-text-3">Send a test event</p>
        <div className="mt-2 flex items-start gap-2">
          <pre className="fk-mono-data m-0 min-w-0 flex-1 overflow-x-auto whitespace-pre rounded-md border border-line bg-surface-2 p-3 text-[11px] leading-[18px] text-text-2">
{`curl -X POST ${url} \\
  -H 'content-type: application/json' \\
  -d '{"type":"payment.succeeded","amount":12000}'`}
          </pre>
          <CopyButton
            text={`curl -X POST ${url} -H 'content-type: application/json' -d '{"type":"payment.succeeded","amount":12000}'`}
            label=""
            ariaLabel="Copy curl command"
            variant="ghost"
            className="!w-11 !px-0 md:!w-8"
          />
        </div>
      </div>
    </div>
  );

  return (
    <ToastProvider>
      <div className="flex h-dvh flex-col overflow-hidden bg-surface-0">
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-divider bg-surface-1 px-4">
          <div className="flex min-w-0 items-center gap-6">
            <LogoLink />
            <nav aria-label="Main" className="flex items-center gap-4 text-[13px]">
              <Link href="/docs" className="-mx-2 inline-flex h-11 items-center px-2 text-text-2 hover:text-text-1">
                Docs
              </Link>
              <Link href="/privacy" className="-mx-2 hidden h-11 items-center px-2 text-text-2 hover:text-text-1 sm:inline-flex">
                Privacy
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-1">
            {site.github ? (
              <Tip label="GitHub repository">
                <a
                  href={site.github}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label="GitHub repository"
                  className="inline-flex size-11 items-center justify-center rounded-md text-text-2 hover:bg-hover hover:text-text-1 md:size-8"
                >
                  <GitHubIcon size={20} />
                </a>
              </Tip>
            ) : null}
            <EndpointMenu
              tokenTail={tail}
              rejected={rejected}
              payloadCount={count}
              onRotated={onRotated}
              onDeleted={onDeleted}
            />
          </div>
        </header>

        <main id="main" className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 border-b border-divider bg-surface-1 px-4 py-0.5 md:py-2">
            <div className="flex h-4 items-baseline justify-between gap-3">
              <p className="fk-micro text-text-3">Webhook URL</p>
              <p className="fk-nums text-[11px] leading-4 text-text-3">
                {count} {count === 1 ? "event" : "events"} · deleted after 72 hours
              </p>
            </div>
            <div className="mt-0 flex items-center gap-2 md:mt-1">
              <code
                ref={urlRef}
                tabIndex={0}
                onClick={(event) => selectNodeText(event.currentTarget)}
                className="fk-mono-data flex h-11 min-w-0 flex-1 cursor-text select-all items-center overflow-x-auto whitespace-nowrap rounded-lg bg-surface-2 px-3 text-[13px] leading-5 text-text-1 outline-offset-2 md:h-9"
                aria-label="Webhook URL"
              >
                {url}
              </code>
              <CopyButton
                text={url}
                variant="primary"
                selectOnError={() => selectNodeText(urlRef.current)}
              />
              <RotateUrlButton onRotated={onRotated} />
            </div>
          </div>

          <div className="flex h-11 shrink-0 border-b border-divider bg-surface-1 md:hidden" role="group" aria-label="Views">
            {(
              [
                ["stream", "Stream"],
                ["generate", "Generate"],
                ["detail", "Detail"],
              ] as const
            ).map(([value, label]) => {
              const active = mobileTab === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setMobileTab(value)}
                  className={`relative flex-1 text-[12px] font-medium ${
                    active ? "text-text-1" : "text-text-2"
                  }`}
                >
                  {label}
                  {active ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-4 bottom-0 h-[2px] bg-primary"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="flex min-h-0 flex-1">
            <div
              className={`min-h-0 w-full border-r border-divider md:flex md:w-[46%] lg:w-[42%] ${
                mobileTab === "stream" ? "flex" : "hidden"
              }`}
            >
              <div className="min-h-0 w-full">
                <CatchStream
                  events={events}
                  selectedSeq={selectedSeq}
                  onSelect={openDetail}
                  pendingCount={pending.length}
                  onJumpTop={jumpToTop}
                  connection={connection}
                  initialMaxSeq={initialEvents[0]?.seq ?? 0}
                  empty={emptyState}
                  onAtTopChange={(value) => {
                    atTopRef.current = value;
                  }}
                />
              </div>
            </div>

            <div
              className={`min-h-0 w-full md:flex md:w-[54%] lg:w-[58%] ${
                mobileTab === "generate" ? "flex" : "hidden"
              }`}
            >
              <div className="min-h-0 w-full">
                <CodePanel schemas={schemas} events={events} />
              </div>
            </div>

            {mobileTab === "detail" ? (
              <div className="flex min-h-0 w-full flex-col bg-surface-0 md:hidden">
                {selectedEvent ? (
                  <div className="flex flex-col gap-4 p-4">
                    <div>
                      <p className="fk-micro text-text-3">Selected payload</p>
                      <p className="mt-1 text-[13px] font-medium text-text-1">
                        {selectedEvent.eventType === "_unknown"
                          ? "unknown event"
                          : selectedEvent.eventType}
                      </p>
                      <p className="fk-mono-data fk-nums mt-1 text-[11px] text-text-3">
                        <span suppressHydrationWarning>
                          {formatClock(selectedEvent.receivedAt)}
                        </span>{" "}
                        · {formatBytes(selectedEvent.bodySize)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={openSelected}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary-container px-4 text-[13px] font-medium text-on-primary-container"
                    >
                      Open payload
                    </button>
                    <button
                      type="button"
                      onClick={() => setMobileTab("stream")}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-outline px-4 text-[13px] text-text-1"
                    >
                      Back to stream
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-start gap-3 p-4">
                    <p className="fk-title text-text-1">No payload selected</p>
                    <p className="max-w-[40ch] text-[12px] leading-[18px] text-text-2">
                      Pick a row in the stream to inspect its parsed body, raw bytes, headers,
                      and inferred types.
                    </p>
                    <button
                      type="button"
                      onClick={() => setMobileTab("stream")}
                      className="inline-flex h-11 items-center rounded-md border border-outline px-4 text-[13px] text-text-1"
                    >
                      Open stream
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </main>

        <PayloadDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onClosed={focusAfterDrawer}
          seq={selectedSeq}
          detail={detail}
          loading={detailLoading}
          error={detailError}
          schema={detailSchema}
          onRetry={() => {
            if (selectedSeq !== null) void loadDetail(selectedSeq);
          }}
        />
      </div>
    </ToastProvider>
  );
}
