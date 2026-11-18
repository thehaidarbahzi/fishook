import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  Endpoint,
  EventDetail,
  EventSummary,
  IngestRejection,
  NewEvent,
  ParseStatus,
  SchemaDoc,
  SchemaMap,
  StoredEvent,
} from "../types";
import { recomputeEndpointSchemas } from "../schema-service";
import type { EventBody, Store } from "./types";

const RETENTION_MS = 72 * 60 * 60 * 1000;
const REJECTION_WINDOW_MS = 60 * 60 * 1000;
const MAX_EVENTS = 2000;

interface LocalEventRow {
  id: string;
  seq: number;
  endpointId: string;
  eventType: string;
  providerEventId: string | null;
  isDuplicate: boolean;
  duplicateOf: string | null;
  method: string;
  path: string;
  queryString: string | null;
  headers: { n: string; v: string }[];
  rawBodyB64: string;
  bodySha256: string;
  bodySize: number;
  contentType: string | null;
  parseStatus: ParseStatus;
  sourceIp: string | null;
  receivedAt: string;
}

interface LocalEndpointRow {
  id: string;
  tokenHash: string;
  tokenTail: string;
  createdAt: string;
  lastReceivedAt: string | null;
}

interface LocalData {
  version: 1;
  seq: number;
  endpoints: LocalEndpointRow[];
  events: LocalEventRow[];
  schemas: Record<string, SchemaDoc>;
  rejections: IngestRejection[];
}

function emptyData(): LocalData {
  return {
    version: 1,
    seq: 0,
    endpoints: [],
    events: [],
    schemas: {},
    rejections: [],
  };
}

function toSummary(row: LocalEventRow): EventSummary {
  return {
    id: row.id,
    seq: row.seq,
    eventType: row.eventType,
    isDuplicate: row.isDuplicate,
    duplicateOf: row.duplicateOf,
    method: row.method,
    parseStatus: row.parseStatus,
    contentType: row.contentType,
    bodySize: row.bodySize,
    receivedAt: row.receivedAt,
  };
}

function toStored(row: LocalEventRow): StoredEvent {
  return {
    ...toSummary(row),
    endpointId: row.endpointId,
    providerEventId: row.providerEventId,
    path: row.path,
    queryString: row.queryString,
    headers: row.headers,
    rawBody: new Uint8Array(Buffer.from(row.rawBodyB64, "base64")),
    bodySha256: row.bodySha256,
    sourceIp: row.sourceIp,
  };
}

export class LocalStore implements Store {
  readonly mode = "local" as const;
  private data: LocalData;
  private readonly file: string;
  private writeChain: Promise<void> = Promise.resolve();
  private lastPrune = 0;
  private pruning = false;

  constructor(dir = process.env.FISHOOK_DATA_DIR || path.join(process.cwd(), ".data")) {
    this.file = path.join(dir, "store.json");
    mkdirSync(dir, { recursive: true });
    this.data = this.load();
  }

  private load(): LocalData {
    try {
      const raw = readFileSync(this.file, "utf8");
      const parsed = JSON.parse(raw) as LocalData;
      if (parsed.version !== 1) return emptyData();
      return parsed;
    } catch {
      return emptyData();
    }
  }

  private persist(): void {
    const snapshot = JSON.stringify(this.data);
    const target = this.file;
    const temp = `${target}.${process.pid}.tmp`;
    this.writeChain = this.writeChain
      .then(async () => {
        await writeFile(temp, snapshot, "utf8");
        await rename(temp, target);
      })
      .catch((error) => {
        console.error("fishook: local store write failed", error);
      });
  }

  private async pruneIfDue(): Promise<void> {
    if (this.pruning) return;
    const now = Date.now();
    if (now - this.lastPrune < 60_000) return;
    this.pruning = true;
    this.lastPrune = now;
    try {
      const cutoff = new Date(now - RETENTION_MS).toISOString();
      const rejectionCutoff = new Date(now - REJECTION_WINDOW_MS).toISOString();

      const before = this.data.events.length;
      const affected = new Set<string>();
      for (const event of this.data.events) {
        if (event.receivedAt < cutoff) affected.add(event.endpointId);
      }
      this.data.events = this.data.events.filter((event) => event.receivedAt >= cutoff);
      this.data.rejections = this.data.rejections.filter(
        (rejection) => rejection.at >= rejectionCutoff,
      );

      if (this.data.events.length !== before) {
        this.persist();
        for (const endpointId of affected) {
          await recomputeEndpointSchemas(this, endpointId);
        }
      }
    } finally {
      this.pruning = false;
    }
  }

  async createEndpoint(tokenHash: string, tokenTail: string): Promise<Endpoint> {
    const row: LocalEndpointRow = {
      id: randomUUID(),
      tokenHash,
      tokenTail,
      createdAt: new Date().toISOString(),
      lastReceivedAt: null,
    };
    this.data.endpoints.push(row);
    this.persist();
    return this.endpointToPublic(row);
  }

  private endpointToPublic(row: LocalEndpointRow): Endpoint {
    const cutoff = new Date(Date.now() - REJECTION_WINDOW_MS).toISOString();
    const rejected = this.data.rejections.filter(
      (item) => item.endpointId === row.id && item.at >= cutoff,
    ).length;
    return {
      id: row.id,
      tokenHash: row.tokenHash,
      tokenTail: row.tokenTail,
      createdAt: row.createdAt,
      lastReceivedAt: row.lastReceivedAt,
      rejectedLastHour: rejected,
    };
  }

  async getEndpoint(id: string): Promise<Endpoint | null> {
    const row = this.data.endpoints.find((item) => item.id === id);
    return row ? this.endpointToPublic(row) : null;
  }

  async getEndpointByTokenHash(hash: string): Promise<Endpoint | null> {
    const row = this.data.endpoints.find((item) => item.tokenHash === hash);
    return row ? this.endpointToPublic(row) : null;
  }

  async rotateToken(id: string, tokenHash: string, tokenTail: string): Promise<void> {
    const row = this.data.endpoints.find((item) => item.id === id);
    if (!row) return;
    row.tokenHash = tokenHash;
    row.tokenTail = tokenTail;
    this.persist();
  }

  async deleteEndpoint(id: string): Promise<void> {
    this.data.endpoints = this.data.endpoints.filter((item) => item.id !== id);
    this.data.events = this.data.events.filter((event) => event.endpointId !== id);
    this.data.rejections = this.data.rejections.filter((item) => item.endpointId !== id);
    for (const key of Object.keys(this.data.schemas)) {
      if (key.startsWith(`${id}::`)) delete this.data.schemas[key];
    }
    this.persist();
  }

  async touchEndpoint(id: string): Promise<void> {
    const row = this.data.endpoints.find((item) => item.id === id);
    if (!row) return;
    row.lastReceivedAt = new Date().toISOString();
    this.persist();
  }

  async recordRejection(endpointId: string): Promise<void> {
    this.data.rejections.push({ endpointId, at: new Date().toISOString() });
    this.persist();
  }

  async rejectedLastHour(endpointId: string): Promise<number> {
    const cutoff = new Date(Date.now() - REJECTION_WINDOW_MS).toISOString();
    return this.data.rejections.filter(
      (item) => item.endpointId === endpointId && item.at >= cutoff,
    ).length;
  }

  async insertEvent(event: NewEvent): Promise<EventSummary> {
    await this.pruneIfDue();

    let duplicateOf: string | null = null;
    if (event.providerEventId) {
      const cutoff = new Date(Date.now() - RETENTION_MS).toISOString();
      const original = this.data.events.find(
        (item) =>
          item.endpointId === event.endpointId &&
          item.providerEventId === event.providerEventId &&
          item.receivedAt >= cutoff,
      );
      if (original) duplicateOf = original.id;
    }

    this.data.seq += 1;
    const row: LocalEventRow = {
      id: randomUUID(),
      seq: this.data.seq,
      endpointId: event.endpointId,
      eventType: event.eventType,
      providerEventId: event.providerEventId,
      isDuplicate: duplicateOf !== null,
      duplicateOf,
      method: event.method,
      path: event.path,
      queryString: event.queryString,
      headers: event.headers,
      rawBodyB64: Buffer.from(event.rawBody).toString("base64"),
      bodySha256: event.bodySha256,
      bodySize: event.bodySize,
      contentType: event.contentType,
      parseStatus: event.parseStatus,
      sourceIp: event.sourceIp,
      receivedAt: new Date().toISOString(),
    };

    this.data.events.push(row);

    const endpointEvents = this.data.events.filter(
      (item) => item.endpointId === event.endpointId,
    );
    if (endpointEvents.length > MAX_EVENTS) {
      const excess = endpointEvents.length - MAX_EVENTS;
      const remove = new Set(
        endpointEvents
          .sort((a, b) => a.seq - b.seq)
          .slice(0, excess)
          .map((item) => item.id),
      );
      this.data.events = this.data.events.filter((item) => !remove.has(item.id));
    }

    this.persist();
    return toSummary(row);
  }

  async listEvents(
    endpointId: string,
    options: { limit: number; afterSeq?: number },
  ): Promise<EventSummary[]> {
    await this.pruneIfDue();
    const after = options.afterSeq ?? 0;
    return this.data.events
      .filter((event) => event.endpointId === endpointId && event.seq > after)
      .sort((a, b) => b.seq - a.seq)
      .slice(0, options.limit)
      .map(toSummary);
  }

  async getEvent(endpointId: string, seq: number): Promise<EventDetail | null> {
    await this.pruneIfDue();
    const row = this.data.events.find(
      (event) => event.endpointId === endpointId && event.seq === seq,
    );
    if (!row) return null;
    const stored = toStored(row);
    return {
      ...toSummary(row),
      headers: stored.headers,
      rawBodyBase64: row.rawBodyB64,
      bodySha256: stored.bodySha256,
      path: stored.path,
      queryString: stored.queryString,
      sourceIp: stored.sourceIp,
    };
  }

  async countEvents(endpointId: string): Promise<number> {
    return this.data.events.filter((event) => event.endpointId === endpointId).length;
  }

  async pruneEvents(endpointId: string, maxEvents: number): Promise<void> {
    const endpointEvents = this.data.events
      .filter((event) => event.endpointId === endpointId)
      .sort((a, b) => a.seq - b.seq);
    if (endpointEvents.length <= maxEvents) return;
    const remove = new Set(
      endpointEvents.slice(0, endpointEvents.length - maxEvents).map((item) => item.id),
    );
    this.data.events = this.data.events.filter((event) => !remove.has(event.id));
    this.persist();
  }

  async listBodies(endpointId: string, eventType?: string): Promise<EventBody[]> {
    await this.pruneIfDue();
    return this.data.events
      .filter(
        (event) =>
          event.endpointId === endpointId &&
          (eventType === undefined || event.eventType === eventType),
      )
      .sort((a, b) => b.seq - a.seq)
      .slice(0, MAX_EVENTS)
      .map((event) => ({
        id: event.id,
        seq: event.seq,
        eventType: event.eventType,
        parseStatus: event.parseStatus,
        body: new Uint8Array(Buffer.from(event.rawBodyB64, "base64")),
      }));
  }

  async getSchemas(endpointId: string): Promise<SchemaMap> {
    await this.pruneIfDue();
    const map: SchemaMap = {};
    for (const [key, value] of Object.entries(this.data.schemas)) {
      if (key.startsWith(`${endpointId}::`)) {
        map[key.slice(endpointId.length + 2)] = value;
      }
    }
    return map;
  }

  async putSchema(endpointId: string, eventType: string, doc: SchemaDoc): Promise<void> {
    this.data.schemas[`${endpointId}::${eventType}`] = doc;
    this.persist();
  }

  async deleteSchema(endpointId: string, eventType: string): Promise<void> {
    delete this.data.schemas[`${endpointId}::${eventType}`];
    this.persist();
  }
}

const globalStore = globalThis as unknown as { __fishookLocalStore?: LocalStore };

export function localStore(): LocalStore {
  if (!globalStore.__fishookLocalStore) {
    globalStore.__fishookLocalStore = new LocalStore();
  }
  return globalStore.__fishookLocalStore;
}
