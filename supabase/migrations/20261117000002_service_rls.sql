-- RLS policies for service_role writes.
-- The ingest path uses a SECURITY DEFINER function (ingest_event) which already
-- runs as the definer (postgres). The server also writes directly to endpoints,
-- schemas, and ingest_rejections using the service role key. These policies
-- allow those writes.

-- endpoints: server creates, rotates, deletes, touches
create policy endpoints_service_insert on public.endpoints
  for insert to service_role with check (true);

create policy endpoints_service_update on public.endpoints
  for update to service_role using (true) with check (true);

create policy endpoints_service_delete on public.endpoints
  for delete to service_role using (true);

-- schemas: server upserts and deletes per (endpoint_id, event_type)
create policy schemas_service_insert on public.schemas
  for insert to service_role with check (true);

create policy schemas_service_update on public.schemas
  for update to service_role using (true) with check (true);

create policy schemas_service_delete on public.schemas
  for delete to service_role using (true);

-- ingest_rejections: server inserts rejections
create policy ingest_rejections_service_insert on public.ingest_rejections
  for insert to service_role with check (true);