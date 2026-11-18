import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  Endpoint,
  EventDetail,
  EventSummary,
  NewEvent,
  ParseStatus,
  SchemaDoc,
  SchemaMap,
} from "../types";
import type { EventBody, Store } from "./types";

const RETENTION_MS = 72 * 60 * 60 * 1000;
const REJECTION_WINDOW_MS = 60 * 60 * 1000;

interface EndpointRow {
  id: string;
  token_hash: string;
  token_last4: string;
  created_at: string;
  last_received_at: string | null;
}

interface EventRow {
  id: string;
  seq: number;
  endpoint_id: string;
  event_type: string;
  provider_event_id: string | null;
  is_duplicate: boolean;
  duplicate_of: string | null;
  method: string;
  path: string;
  query_string: string | null;
  headers: { n: string; v: string }[];
  raw_body: string;
  body_sha256: string;
  body_size: number;
  content_type: string | null;
  parse_status: ParseStatus;
  source_ip: string | null;
  received_at: string;
}

function decodeBytea(value: string | null): Uint8Array {
  if (!value) return new Uint8Array();
  if (value.startsWith("\\x")) {
    return new Uint8Array(Buffer.from(value.slice(2), "hex"));
  }
  return new Uint8Array(Buffer.from(value, "base64"));
}

function toSummary(row: {
  id: string;
  seq: number;
  event_type: string;
  is_duplicate: boolean;
  duplicate_of: string | null;
  method: string;
  parse_status: ParseStatus;
  content_type: string | null;
  body_size: number;
  received_at: string;
}): EventSummary {
  return {
    id: row.id,
    seq: row.seq,
    eventType: row.event_type,
    isDuplicate: row.is_duplicate,
    duplicateOf: row.duplicate_of,
    method: row.method,
    parseStatus: row.parse_status,
    contentType: row.content_type,
    bodySize: row.body_size,
    receivedAt: row.received_at,
  };
}

export class SupabaseStore implements Store {
  readonly mode = "supabase" as const;
  private client: SupabaseClient;

  constructor(url: string, serviceKey: string) {
    this.client = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "x-fishook-store": "server" } },
    });
  }

  private async rejectedCount(endpointId: string): Promise<number> {
    const cutoff = new Date(Date.now() - REJECTION_WINDOW_MS).toISOString();
    const { count, error } = await this.client
      .from("ingest_rejections")
      .select("endpoint_id", { count: "exact", head: true })
      .eq("endpoint_id", endpointId)
      .gte("at", cutoff);
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  private async toEndpoint(row: EndpointRow): Promise<Endpoint> {
    return {
      id: row.id,
      tokenHash: row.token_hash,
      tokenTail: row.token_last4,
      createdAt: row.created_at,
      lastReceivedAt: row.last_received_at,
      rejectedLastHour: await this.rejectedCount(row.id),
    };
  }

  async createEndpoint(tokenHash: string, tokenTail: string): Promise<Endpoint> {
    const { data, error } = await this.client
      .from("endpoints")
      .insert({ token_hash: tokenHash, token_last4: tokenTail })
      .select("id, token_hash, token_last4, created_at, last_received_at")
      .single();
    if (error) throw new Error(error.message);
    return this.toEndpoint(data as EndpointRow);
  }

  async getEndpoint(id: string): Promise<Endpoint | null> {
    const { data, error } = await this.client
      .from("endpoints")
      .select("id, token_hash, token_last4, created_at, last_received_at")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? this.toEndpoint(data as EndpointRow) : null;
  }

  async getEndpointByTokenHash(hash: string): Promise<Endpoint | null> {
    const { data, error } = await this.client
      .from("endpoints")
      .select("id, token_hash, token_last4, created_at, last_received_at")
      .eq("token_hash", hash)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? this.toEndpoint(data as EndpointRow) : null;
  }

  async rotateToken(id: string, tokenHash: string, tokenTail: string): Promise<void> {
    const { error } = await this.client
      .from("endpoints")
      .update({ token_hash: tokenHash, token_last4: tokenTail })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }

  async deleteEndpoint(id: string): Promise<void> {
    const { error } = await this.client.from("endpoints").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async touchEndpoint(id: string): Promise<void> {
    const { error } = await this.client
      .from("endpoints")
      .update({ last_received_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }

  async recordRejection(endpointId: string): Promise<void> {
    const { error } = await this.client
      .from("ingest_rejections")
      .insert({ endpoint_id: endpointId });
    if (error) throw new Error(error.message);
  }

  async rejectedLastHour(endpointId: string): Promise<number> {
    return this.rejectedCount(endpointId);
  }

  async insertEvent(event: NewEvent): Promise<EventSummary> {
    let duplicateOf: string | null = null;
    if (event.providerEventId) {
      const cutoff = new Date(Date.now() - RETENTION_MS).toISOString();
      const { data, error } = await this.client
        .from("events")
        .select("id")
        .eq("endpoint_id", event.endpointId)
        .eq("provider_event_id", event.providerEventId)
        .gte("received_at", cutoff)
        .order("received_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      duplicateOf = data ? (data as { id: string }).id : null;
    }

    const { data: seq, error } = await this.client.rpc("ingest_event", {
      p_token_hash: event.tokenHash,
      p_event_type: event.eventType,
      p_provider_event_id: event.providerEventId,
      p_method: event.method,
      p_path: event.path,
      p_query_string: event.queryString,
      p_headers: event.headers,
      p_raw_body: "\\x" + Buffer.from(event.rawBody).toString("hex"),
      p_sha256: event.bodySha256,
      p_content_type: event.contentType,
      p_parse_status: event.parseStatus,
      p_source_ip: event.sourceIp,
    });

    if (error) throw new Error(error.message);
    const seqValue = typeof seq === "number" ? seq : Number(seq);

    const { data: row, error: lookupError } = await this.client
      .from("events")
      .select("id")
      .eq("seq", seqValue)
      .single();
    if (lookupError) throw new Error(lookupError.message);
    const id = (row as { id: string }).id;

    if (duplicateOf) {
      const { error: markError } = await this.client
        .from("events")
        .update({ is_duplicate: true, duplicate_of: duplicateOf })
        .eq("id", id);
      if (markError) throw new Error(markError.message);
    }

    await this.pruneEvents(event.endpointId, 2000);

    return {
      id,
      seq: seqValue,
      eventType: event.eventType,
      isDuplicate: duplicateOf !== null,
      duplicateOf,
      method: event.method,
      parseStatus: event.parseStatus,
      contentType: event.contentType,
      bodySize: event.bodySize,
      receivedAt: new Date().toISOString(),
    };
  }

  async listEvents(
    endpointId: string,
    options: { limit: number; afterSeq?: number },
  ): Promise<EventSummary[]> {
    let query = this.client
      .from("events")
      .select(
        "id, seq, event_type, is_duplicate, duplicate_of, method, parse_status, content_type, body_size, received_at",
      )
      .eq("endpoint_id", endpointId)
      .order("seq", { ascending: false })
      .limit(options.limit);

    if (options.afterSeq) query = query.gt("seq", options.afterSeq);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) =>
      toSummary(row as Parameters<typeof toSummary>[0]),
    );
  }

  async getEvent(endpointId: string, seq: number): Promise<EventDetail | null> {
    const { data, error } = await this.client
      .from("events")
      .select("*")
      .eq("endpoint_id", endpointId)
      .eq("seq", seq)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const row = data as EventRow;
    return {
      ...toSummary(row),
      headers: row.headers,
      rawBodyBase64: Buffer.from(decodeBytea(row.raw_body)).toString("base64"),
      bodySha256: row.body_sha256,
      path: row.path,
      queryString: row.query_string,
      sourceIp: row.source_ip,
    };
  }

  async countEvents(endpointId: string): Promise<number> {
    const { count, error } = await this.client
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("endpoint_id", endpointId);
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  async pruneEvents(endpointId: string, maxEvents: number): Promise<void> {
    const count = await this.countEvents(endpointId);
    if (count <= maxEvents) return;
    const { data, error } = await this.client
      .from("events")
      .select("seq")
      .eq("endpoint_id", endpointId)
      .order("seq", { ascending: true })
      .limit(count - maxEvents);
    if (error) throw new Error(error.message);
    const seqs = (data ?? []).map((row) => (row as { seq: number }).seq);
    if (seqs.length === 0) return;
    const { error: deleteError } = await this.client
      .from("events")
      .delete()
      .eq("endpoint_id", endpointId)
      .in("seq", seqs);
    if (deleteError) throw new Error(deleteError.message);
  }

  async listBodies(endpointId: string, eventType?: string): Promise<EventBody[]> {
    let query = this.client
      .from("events")
      .select("id, seq, event_type, parse_status, raw_body")
      .eq("endpoint_id", endpointId)
      .order("seq", { ascending: false })
      .limit(2000);

    if (eventType) query = query.eq("event_type", eventType);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => {
      const item = row as {
        id: string;
        seq: number;
        event_type: string;
        parse_status: ParseStatus;
        raw_body: string;
      };
      return {
        id: item.id,
        seq: item.seq,
        eventType: item.event_type,
        parseStatus: item.parse_status,
        body: decodeBytea(item.raw_body),
      };
    });
  }

  async getSchemas(endpointId: string): Promise<SchemaMap> {
    const { data, error } = await this.client
      .from("schemas")
      .select("event_type, schema")
      .eq("endpoint_id", endpointId);
    if (error) throw new Error(error.message);
    const map: SchemaMap = {};
    for (const row of data ?? []) {
      const item = row as { event_type: string; schema: SchemaDoc };
      map[item.event_type] = item.schema;
    }
    return map;
  }

  async putSchema(endpointId: string, eventType: string, doc: SchemaDoc): Promise<void> {
    const { error } = await this.client.from("schemas").upsert(
      {
        endpoint_id: endpointId,
        event_type: eventType,
        schema: doc,
        conflicts: doc.conflicts,
        sample_count: doc.samples,
        updated_at: doc.updatedAt,
      },
      { onConflict: "endpoint_id,event_type" },
    );
    if (error) throw new Error(error.message);
  }

  async deleteSchema(endpointId: string, eventType: string): Promise<void> {
    const { error } = await this.client
      .from("schemas")
      .delete()
      .eq("endpoint_id", endpointId)
      .eq("event_type", eventType);
    if (error) throw new Error(error.message);
  }
}
