import type {
  Endpoint,
  EventDetail,
  EventSummary,
  NewEvent,
  ParseStatus,
  SchemaDoc,
  SchemaMap,
} from "../types";

export interface EventBody {
  id: string;
  seq: number;
  eventType: string;
  parseStatus: ParseStatus;
  body: Uint8Array;
}

export interface Store {
  readonly mode: "supabase" | "local";

  createEndpoint(tokenHash: string, tokenTail: string): Promise<Endpoint>;
  getEndpoint(id: string): Promise<Endpoint | null>;
  getEndpointByTokenHash(hash: string): Promise<Endpoint | null>;
  rotateToken(id: string, tokenHash: string, tokenTail: string): Promise<void>;
  deleteEndpoint(id: string): Promise<void>;
  touchEndpoint(id: string): Promise<void>;

  recordRejection(endpointId: string): Promise<void>;
  rejectedLastHour(endpointId: string): Promise<number>;

  insertEvent(event: NewEvent): Promise<EventSummary>;
  listEvents(
    endpointId: string,
    options: { limit: number; afterSeq?: number },
  ): Promise<EventSummary[]>;
  getEvent(endpointId: string, seq: number): Promise<EventDetail | null>;
  countEvents(endpointId: string): Promise<number>;
  pruneEvents(endpointId: string, maxEvents: number): Promise<void>;

  listBodies(endpointId: string, eventType?: string): Promise<EventBody[]>;
  getSchemas(endpointId: string): Promise<SchemaMap>;
  putSchema(endpointId: string, eventType: string, doc: SchemaDoc): Promise<void>;
  deleteSchema(endpointId: string, eventType: string): Promise<void>;
}
