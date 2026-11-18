-- fishook schema
-- Run with the Supabase CLI, or paste into the SQL editor in order.
-- The app never exposes these tables to anon. Reads go through Next.js route
-- handlers that verify the signed read cookie and then use the service role.

create type public.event_parse_status as enum (
  'ok',
  'invalid_json',
  'not_json',
  'empty',
  'root_not_object'
);

create table public.endpoints (
  id               uuid primary key default gen_random_uuid(),
  -- Reserved for v2 accounts. Null in v1 because endpoints are cookie-scoped.
  user_id          uuid references auth.users(id) on delete set null,
  token_hash       text not null unique,
  token_last4      text not null,
  created_at       timestamptz not null default now(),
  last_received_at timestamptz
);

create table public.events (
  id                uuid primary key default gen_random_uuid(),
  seq               bigint generated always as identity unique,
  endpoint_id       uuid not null references public.endpoints(id) on delete cascade,
  event_type        text not null default '_unknown',
  provider_event_id text,
  is_duplicate      boolean not null default false,
  duplicate_of      uuid references public.events(id) on delete set null,
  method            text not null,
  -- Normalized to '/api/h/:token'. The plaintext token is never stored.
  path              text not null,
  query_string      text,
  -- Array, not object: objects collapse repeated headers such as Set-Cookie.
  headers           jsonb not null default '[]'::jsonb,
  -- bytea keeps NUL bytes and invalid UTF-8 intact. text would not.
  raw_body          bytea not null,
  body_sha256       text not null,
  body_size         integer not null,
  content_type      text,
  parse_status      public.event_parse_status not null,
  source_ip         inet,
  received_at       timestamptz not null default now()
);

create table public.schemas (
  endpoint_id  uuid not null references public.endpoints(id) on delete cascade,
  event_type   text not null,
  schema       jsonb not null,
  -- Integer count for the UI. Full conflict detail lives inside schema.
  conflicts    integer not null default 0,
  sample_count integer not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (endpoint_id, event_type)
);

create table public.ingest_rejections (
  id          bigint generated always as identity primary key,
  endpoint_id uuid not null references public.endpoints(id) on delete cascade,
  at          timestamptz not null default now()
);

create index events_endpoint_seq_idx on public.events (endpoint_id, seq desc);
create index events_endpoint_type_idx on public.events (endpoint_id, event_type, seq desc);
create index events_received_idx on public.events (received_at);
create index events_provider_id_idx on public.events (endpoint_id, provider_event_id)
  where provider_event_id is not null;
create index ingest_rejections_endpoint_at_idx
  on public.ingest_rejections (endpoint_id, at desc);

alter table public.endpoints enable row level security;
alter table public.events enable row level security;
alter table public.schemas enable row level security;
alter table public.ingest_rejections enable row level security;

-- v1 has no writable anon path. These owner policies are for v2 accounts; they
-- are inert while endpoints.user_id is null.
create policy endpoints_owner_select on public.endpoints
  for select using (user_id = auth.uid());

create policy events_owner_select on public.events
  for select using (
    exists (
      select 1 from public.endpoints e
      where e.id = events.endpoint_id and e.user_id = auth.uid()
    )
  );

create policy schemas_owner_select on public.schemas
  for select using (
    exists (
      select 1 from public.endpoints e
      where e.id = schemas.endpoint_id and e.user_id = auth.uid()
    )
  );

revoke insert, update, delete on public.endpoints from anon, authenticated;
revoke insert, update, delete on public.events from anon, authenticated;
revoke insert, update, delete on public.schemas from anon, authenticated;
revoke insert, update, delete on public.ingest_rejections from anon, authenticated;

-- Ingest is the only write path. The route hashes the token before calling this
-- function; the plaintext token never reaches Postgres.
create or replace function public.ingest_event(
  p_token_hash text,
  p_event_type text,
  p_provider_event_id text,
  p_method text,
  p_path text,
  p_query_string text,
  p_headers jsonb,
  p_raw_body bytea,
  p_sha256 text,
  p_content_type text,
  p_parse_status public.event_parse_status,
  p_source_ip inet
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_endpoint uuid;
  v_seq bigint;
begin
  if octet_length(p_raw_body) > 262144 then
    raise exception 'payload_too_large';
  end if;

  select id into v_endpoint
    from endpoints
   where token_hash = p_token_hash;

  if v_endpoint is null then
    return null;
  end if;

  insert into events (
    endpoint_id, event_type, provider_event_id, method, path, query_string,
    headers, raw_body, body_sha256, body_size, content_type, parse_status,
    source_ip
  ) values (
    v_endpoint, p_event_type, p_provider_event_id, p_method, p_path,
    p_query_string, p_headers, p_raw_body, p_sha256, octet_length(p_raw_body),
    p_content_type, p_parse_status, p_source_ip
  ) returning seq into v_seq;

  update endpoints
     set last_received_at = now()
   where id = v_endpoint;

  return v_seq;
end;
$$;

revoke all on function public.ingest_event(
  text, text, text, text, text, text, jsonb, bytea, text, text,
  public.event_parse_status, inet
) from public;
revoke all on function public.ingest_event(
  text, text, text, text, text, text, jsonb, bytea, text, text,
  public.event_parse_status, inet
) from anon, authenticated;
grant execute on function public.ingest_event(
  text, text, text, text, text, text, jsonb, bytea, text, text,
  public.event_parse_status, inet
) to service_role;
