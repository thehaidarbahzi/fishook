# fishook

Catch webhooks, merge samples per event type, and generate Go structs or TypeScript interfaces from the payloads that actually arrived.

fishook is a receiver, not a proxy. It stores the request, groups samples by event type, and rebuilds the schema on every ingest. Nothing is forwarded to your API.

## Stack

- Next.js 16 App Router, React 19, TypeScript
- Tailwind v4 with a small design-token layer in `app/globals.css`
- Supabase Postgres with RLS and a `SECURITY DEFINER` ingest function
- Optional Upstash Redis for rate limits
- Vitest, plus compile checks for generated Go and TypeScript

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, press **Open the app**, and copy the webhook URL. Without Supabase credentials the app uses a file store at `.data/store.json`. That mode is single-process and development only. It is not safe for a serverless deployment or more than one server.

```bash
curl -X POST http://localhost:3000/api/h/<token> \
  -H 'content-type: application/json' \
  -H 'x-event-type: payment.succeeded' \
  -d '{"id":"evt_1","amount":12000,"currency":"USD"}'
```

## Environment

Copy `.env.example` and fill what you need.

| Variable | Required | Notes |
|---|---|---|
| `FISHOOK_COOKIE_SECRET` | Production | At least 16 characters. Signs the read cookie. The app refuses to serve in production without it. |
| `SUPABASE_URL` | Production | Project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | Server only. Never expose it to the browser. |
| `NEXT_PUBLIC_SITE_URL` | Production | Used for metadata and as an origin fallback. |
| `NEXT_PUBLIC_GITHUB_URL` | No | Repository link. The GitHub icon and button are hidden when unset. |
| `UPSTASH_REDIS_REST_URL` | Recommended | Shared rate limiter. Falls back to an in-process map when unset. |
| `UPSTASH_REDIS_REST_TOKEN` | Recommended | Must be set with the URL. |
| `FISHOOK_DATA_DIR` | No | Local store directory. Defaults to `.data`. |

## Supabase

1. Create a project.
2. Enable `pg_cron` in the dashboard if you want the retention job scheduled automatically.
3. Apply the files in `supabase/migrations` in order, with the CLI or the SQL editor.

```bash
supabase db push
```

The migration creates `endpoints`, `events`, `schemas`, `ingest_rejections`, the `event_parse_status` enum, indexes, RLS, and the `ingest_event` function. Reads never go directly from the browser. Route handlers verify the signed cookie and query with the service role. `anon` has no write path.

`schemas.conflicts` is an integer count for the UI. The full conflict detail lives in the `schema` JSON column.

Retention runs through `public.fishook_prune()`: events older than 72 hours, rejections older than one hour, schemas without samples, and events beyond 2,000 per endpoint. See `supabase/README.md` for the cron details.

## Scripts

```bash
npm run typecheck   # tsc --noEmit
npm test            # Vitest, includes go build and tsc on generated output
npm run build       # production build
npm start           # serve the production build
```

The compile tests are skipped when `go` or the local `typescript` binary is missing.

## Limits

- 256 KB request body, checked twice: `Content-Length` and bytes read.
- 60 requests per minute per write token.
- 20 requests per minute per IP for unknown tokens.
- 2,000 events per endpoint; the oldest is removed first.
- 72-hour event retention. Endpoints last until deleted.
- Go and TypeScript output in v1.

## Security notes

- The write token is in the URL path. Hosting access logs can see it. Do not send that path to analytics, shorten log retention, and rotate the URL if a log leaks.
- The database stores only `sha256(token)` and the last four characters. The plaintext token is not recoverable from Postgres.
- The read cookie is httpOnly, SameSite=Lax, signed with `FISHOOK_COOKIE_SECRET`, and lasts one year with sliding renewal. Rotating the secret invalidates existing cookies but leaves endpoints in the database.
- Sensitive headers are masked in the UI with a reveal control. They are stored intact because byte fidelity is the point of the tool.
- RLS is enabled on every table. The ingest function is executable only by `service_role`.

## Layout

```
app/                 routes: landing, docs, privacy, app, API
components/          UI primitives and app surfaces
lib/                 inference, codegen, tokens, store adapters
supabase/            migrations and deployment notes
```

MIT.
