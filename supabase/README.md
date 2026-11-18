# Supabase deployment notes

## Apply the schema

```bash
supabase link --project-ref <ref>
supabase db push
```

Or paste both files in `migrations/` into the SQL editor, in filename order.

The migrations expect a Supabase project because `endpoints.user_id` references `auth.users(id)`. In v1 that column stays null: endpoints are scoped by the signed browser cookie, not by an account. The owner RLS policies are there for a future account mode.

## What is created

| Object | Purpose |
|---|---|
| `event_parse_status` | Enum for parse outcomes. |
| `endpoints` | Token hash, last four characters, timestamps. |
| `events` | Raw body as `bytea`, headers as a JSON array, global `seq`. |
| `schemas` | One inferred document per `(endpoint_id, event_type)`. |
| `ingest_rejections` | Counts for rate-limited and oversized requests. |
| `ingest_event(...)` | `SECURITY DEFINER` write path, executable only by `service_role`. |
| `fishook_prune()` | Retention and per-endpoint pruning. |
| Indexes | Stream reads, event type reads, duplicate lookup, retention. |

RLS is enabled on all four tables. There is no insert, update, or delete grant for `anon` or `authenticated`. Browser reads never touch Postgres; the Next.js route handlers verify the cookie and use the service role.

## Retention

`fishook_prune()` deletes:

- events older than 72 hours,
- rejections older than one hour,
- schemas with no remaining samples for that event type,
- events beyond 2,000 per endpoint.

The migration schedules it hourly with `pg_cron` when the extension is installed:

```sql
select cron.schedule(
  'fishook-prune',
  '7 * * * *',
  $$select public.fishook_prune();$$
);
```

If `pg_cron` is unavailable, schedule the function with the platform scheduler. The app also prunes the 2,000-event cap after each insert, so the cron job is a safety net rather than the only line of defense.

## Verify

```sql
-- The function should be callable only by the service role.
select proname, prosecdef, proacl
from pg_proc
where proname = 'ingest_event';

-- No anon policy should allow writes.
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public';

-- After traffic, confirm body bytes are intact.
select body_size, octet_length(raw_body) as bytes
from events
order by seq desc
limit 5;
```

`body_size` and `octet_length(raw_body)` must match. `body_sha256` is computed by the app over the exact bytes and stored alongside.

## Operational notes

- The write token is in the URL path. Trim or redact it from hosting access logs, or keep log retention short.
- Set `FISHOOK_COOKIE_SECRET` before the first production request. Rotating it invalidates read cookies; endpoints and payloads stay.
- `SUPABASE_SERVICE_ROLE_KEY` must never reach the client bundle. Only import the store from server code.
- If `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set, rate limits are shared across instances. Without them, the in-process limiter is per instance.
