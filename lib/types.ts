export type ParseStatus =
  | "ok"
  | "invalid_json"
  | "not_json"
  | "empty"
  | "root_not_object";

export interface HeaderPair {
  n: string;
  v: string;
}

export interface Endpoint {
  id: string;
  tokenHash: string;
  tokenTail: string;
  createdAt: string;
  lastReceivedAt: string | null;
  rejectedLastHour: number;
}

export interface StoredEvent {
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
  headers: HeaderPair[];
  rawBody: Uint8Array;
  bodySha256: string;
  bodySize: number;
  contentType: string | null;
  parseStatus: ParseStatus;
  sourceIp: string | null;
  receivedAt: string;
}

export interface EventSummary {
  id: string;
  seq: number;
  eventType: string;
  isDuplicate: boolean;
  duplicateOf: string | null;
  method: string;
  parseStatus: ParseStatus;
  contentType: string | null;
  bodySize: number;
  receivedAt: string;
}

export interface EventDetail extends EventSummary {
  headers: HeaderPair[];
  rawBodyBase64: string;
  bodySha256: string;
  path: string;
  queryString: string | null;
  sourceIp: string | null;
}

export interface NewEvent {
  endpointId: string;
  tokenHash: string;
  eventType: string;
  providerEventId: string | null;
  method: string;
  path: string;
  queryString: string | null;
  headers: HeaderPair[];
  rawBody: Uint8Array;
  bodySha256: string;
  bodySize: number;
  contentType: string | null;
  parseStatus: ParseStatus;
  sourceIp: string | null;
}

export type TypeKind =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "object"
  | "array"
  | "unknown";

export interface SchemaField {
  node: SchemaNode;
  present: number;
  nulls: number;
}

export interface SchemaNode {
  kinds: TypeKind[];
  count: number;
  nulls: number;
  integerOnly: boolean;
  precisionRisk: boolean;
  incompleteArray: boolean;
  fields: Record<string, SchemaField>;
  element: SchemaNode | null;
}

export interface SchemaDoc {
  root: SchemaNode;
  samples: number;
  conflicts: number;
  warnings: string[];
  updatedAt: string;
}

export type SchemaMap = Record<string, SchemaDoc>;

export interface IngestRejection {
  endpointId: string;
  at: string;
}
