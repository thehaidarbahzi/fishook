import type { NextRequest } from "next/server";
import { activeSession } from "@/lib/session-server";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONNECTION_MS = 55_000;
const POLL_MS = 1_000;
const HEARTBEAT_MS = 15_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest) {
  const session = await activeSession(request);
  if (!session) {
    return new Response(JSON.stringify({ ok: false, error: "no_session" }), {
      status: 401,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  const queryAfter = Number(request.nextUrl.searchParams.get("after") ?? "0");
  const headerAfter = Number(request.headers.get("last-event-id") ?? "0");
  let lastSeq = Math.max(
    Number.isSafeInteger(queryAfter) ? queryAfter : 0,
    Number.isSafeInteger(headerAfter) ? headerAfter : 0,
  );

  const endpointId = session.endpoint.id;
  const store = getStore();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let lastSchemaJson = "";

      const onAbort = () => {
        closed = true;
      };
      request.signal.addEventListener("abort", onAbort);

      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      send("retry: 2000\n\n");
      send(`event: ready\ndata: ${JSON.stringify({ seq: lastSeq })}\n\n`);

      const started = Date.now();
      let lastBeat = Date.now();

      try {
        while (!closed && Date.now() - started < CONNECTION_MS) {
          const events = await store.listEvents(endpointId, {
            limit: 100,
            afterSeq: lastSeq,
          });

          if (events.length > 0) {
            const ascending = [...events].sort((a, b) => a.seq - b.seq);
            for (const event of ascending) {
              send(`id: ${event.seq}\ndata: ${JSON.stringify(event)}\n\n`);
            }
            lastSeq = ascending[ascending.length - 1].seq;
          }

          // Send the current map on connect, not only after a new event. That
          // repairs a stale initial render and keeps two tabs in sync.
          const schemas = await store.getSchemas(endpointId);
          const encoded = JSON.stringify(schemas);
          if (encoded !== lastSchemaJson) {
            lastSchemaJson = encoded;
            send(`event: schemas\ndata: ${encoded}\n\n`);
          }

          if (Date.now() - lastBeat >= HEARTBEAT_MS) {
            send(": ping\n\n");
            lastBeat = Date.now();
          }

          await sleep(POLL_MS);
        }
      } catch (error) {
        console.error("fishook: stream error", error);
      } finally {
        request.signal.removeEventListener("abort", onAbort);
        if (!closed) {
          send(`event: end\ndata: ${JSON.stringify({ seq: lastSeq })}\n\n`);
        }
        try {
          controller.close();
        } catch {
          // Already closed by the client.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
