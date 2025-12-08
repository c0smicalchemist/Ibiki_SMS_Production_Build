## Goals
- Reduce page/API latency without enabling client/browser caches
- Keep `Cache-Control: no-store` semantics and avoid stale bundles

## Server/API
- Reuse a single PostgreSQL `Pool` across requests (stop creating new `Pool` in handlers)
- Enable gzip/brotli compression at the app layer for JSON (`compression` middleware)
- Stream large JSON results using NDJSON for heavy endpoints (e.g., admin message logs)
- Introduce pagination and selective fields for heavy endpoints (`/api/admin/messages`, `/api/supervisor/messages`) and add `limit`, `cursor` params
- Deduplicate concurrent requests with request coalescing on the server (in‑memory flight map for identical queries)

## Database
- Add generated columns for normalized digits to avoid regex in WHERE:
  - `incoming_messages.normalized_from` and `normalized_receiver`
  - `message_logs.normalized_recipient`
- Create btree indexes on frequently filtered columns:
  - `incoming_messages(user_id, normalized_from)`, `incoming_messages(user_id, normalized_receiver)`
  - `incoming_messages(business)`, partial indexes for `is_deleted = true`
  - `message_logs(user_id, created_at)` and `credit_transactions(user_id)`
- Convert heavy scans (delete conversation and inbox retrieval) to use normalized columns
- Analyze/`EXPLAIN` slow queries and add missing indexes; keep connection pool size tuned (e.g., 10–20)

## Client (React)
- Code‑split large pages (AdminDashboard, Inbox, MessageActivity) with dynamic `import()`
- Prefetch code for hovered/likely routes (`<Link>` prefetch or IntersectionObserver)
- Avoid redundant fetches via React Query de‑dupe; keep `no-store` but add `staleTime` for in‑memory dedupe within a session
- Virtualize long lists (Inbox threads, message logs) to render only visible rows
- Show skeletons and optimistic UI for actions (delete conversation, mark read) to hide round‑trip latency

## Build/Bundling
- Remove source maps in production (reduce `index-*.js.map` 3.8MB); keep them behind a flag if needed
- Precompress assets to `.br` and `.gz` during build; serve the smallest with Nginx
- Split vendor and page chunks to keep initial bundle under ~300–500kB

## Transport/Nginx
- Confirm `http2` and enable `gzip on;` and `brotli` module (if available)
- Serve precompressed assets (`try_files`) with correct `Content-Encoding`
- Keep `/api` proxied with `proxy_request_buffering off` for streaming and low latency

## Observability & Guardrails
- Add `Server-Timing` headers for key endpoints (DB, render, serialization)
- Sample slow requests and log `EXPLAIN ANALYZE` plans periodically
- Track bundle sizes per build; fail CI if main chunk exceeds threshold

## Rollout Steps
1. Implement normalized columns and indexes (migrations) and refactor delete/inbox queries
2. Refactor server to use a shared `pg.Pool` and add compression; add pagination for heavy routes
3. Client: add code‑splitting & virtualization; adjust React Query to de‑dupe without persistent cache
4. Build: disable source maps in production; add precompression
5. Nginx: enable gzip/brotli serving of precompressed assets
6. Validate with timings and adjust pool sizes/indexes as needed

Confirm this plan and I’ll implement the changes, roll out, and verify end‑to‑end timings.