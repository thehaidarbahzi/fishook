import type { SchemaDoc, SchemaMap } from "./types";
import { buildSchema } from "./schema";
import type { EventBody, Store } from "./store/types";

function parseSample(event: EventBody): unknown {
  if (event.parseStatus !== "ok" && event.parseStatus !== "root_not_object") {
    return undefined;
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(event.body);
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function groupSamples(events: EventBody[]): Map<string, unknown[]> {
  const groups = new Map<string, unknown[]>();
  for (const event of events) {
    const sample = parseSample(event);
    if (sample === undefined) continue;
    const list = groups.get(event.eventType);
    if (list) list.push(sample);
    else groups.set(event.eventType, [sample]);
  }
  return groups;
}

export async function recomputeSchemaForType(
  store: Store,
  endpointId: string,
  eventType: string,
): Promise<SchemaDoc | null> {
  const events = await store.listBodies(endpointId, eventType);
  const samples: unknown[] = [];
  for (const event of events) {
    const sample = parseSample(event);
    if (sample !== undefined) samples.push(sample);
  }

  if (samples.length === 0) {
    await store.deleteSchema(endpointId, eventType);
    return null;
  }

  const doc = buildSchema(samples);
  await store.putSchema(endpointId, eventType, doc);
  return doc;
}

export async function recomputeEndpointSchemas(
  store: Store,
  endpointId: string,
): Promise<SchemaMap> {
  const [events, existing] = await Promise.all([
    store.listBodies(endpointId),
    store.getSchemas(endpointId),
  ]);

  const groups = groupSamples(events);
  const map: SchemaMap = {};

  for (const [eventType, samples] of groups) {
    const doc = buildSchema(samples);
    await store.putSchema(endpointId, eventType, doc);
    map[eventType] = doc;
  }

  for (const eventType of Object.keys(existing)) {
    if (!groups.has(eventType)) {
      await store.deleteSchema(endpointId, eventType);
    }
  }

  return map;
}
