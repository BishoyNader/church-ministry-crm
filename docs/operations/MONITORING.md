# Monitoring & Observability

Sprint 2 · Phase 6 — production monitoring foundation.

## Overview

The application ships with an in-house observability foundation that needs no
third-party SDK and works on Vercel, self-hosted Node, and edge runtimes:

| Capability            | Implementation                                              |
| --------------------- | ----------------------------------------------------------- |
| Global structured log | `src/lib/logger.ts` (JSON lines in production)              |
| Request IDs           | `x-request-id` stamped by the proxy, surfaced in every log  |
| Performance timing    | `x-response-time-ms` response header + latency fields       |
| Health checks         | `GET /api/health` (DB probe + env checks + runtime metrics) |
| Runtime diagnostics   | `GET /api/monitoring/diagnostics` (token-gated)             |
| Client error intake   | `POST /api/monitoring/errors` (rate-limited)                |
| Audit trail           | existing `audit_logs` table + structured error logging      |

## Structured Logging

Create a scoped logger and emit levels:

```ts
import { createLogger } from "@/lib/logger";
const log = createLogger("churches.service");
await log.info("church_created", { churchId, byUserId });
await log.error("church_create_failed", { err, churchId });
```

Behavior:

- **Production / `LOG_FORMAT=json`** → one JSON line per entry
  (`ts, level, scope, msg, requestId, ...fields`), ready for log pipelines.
- **Development** → human-readable console lines.
- **Redaction** — keys matching `/password|token|secret|authorization|cookie|api[_-]?key|.../` are replaced with `[REDACTED]`.
- **Error serialization** — pass `err` in fields; it is normalized to
  `{ name, message, stack (8 lines), cause }`.
- **Request correlation** — `getRequestId()` reads the `x-request-id` header
  stamped by the proxy (or generates a fresh UUID).

### Rules

- Server-only. Never import `@/lib/logger` into client components.
- Never log PII, tokens, or full request bodies.
- Use coarse counts and identifiers (`churchId`, `userId`) — never names.

## Request IDs & Timing

The proxy (`src/proxy.ts`) stamps every response with:

- `x-request-id` — a UUID (or upstream-provided value) correlating middleware,
  server actions, services, and downstream logs.
- `x-response-time-ms` — total middleware processing time.

## Health Endpoint — `GET /api/health`

Public liveness probe. Returns `200 {status:"healthy"}` when Supabase is
configured and a read succeeds, else `503 {status:"degraded"}`. Includes
coarse runtime metrics (node version, memory MB, load avg) and env-presence
booleans. Never returns schema, counts, or data.

Recommended monitor: every 60s, alert on 503 for > 2 consecutive checks.

## Runtime Diagnostics — `GET /api/monitoring/diagnostics`

Operator introspection: `GET` with `Authorization: Bearer $DIAGNOSTICS_TOKEN`
(or `$CRON_SECRET` fallback). Returns process metrics, env-presence booleans,
and build metadata. For debugging cold starts, memory, and config drift.

## Client Error Intake — `POST /api/monitoring/errors`

Called by the error boundaries (`global-error.tsx`, `(app)/error.tsx`) and
`src/lib/client-error.ts`. Rate-limited to 30/min/IP to prevent log flooding;
always returns 204/4xx with no response body. Payload is logged as a
structured `client_error` entry with URL, locale, digest, and stack.

## Rollout Checklist

1. Set `LOG_FORMAT=json` in production (or rely on `NODE_ENV=production`).
2. Set `DIAGNOSTICS_TOKEN` (recommended) or rely on `CRON_SECRET`.
3. Point your log aggregator at the JSON-lines stdout.
4. Configure uptime monitoring on `/api/health`.
5. Optional: a nightly health-check audit row or Slack webhook on degraded.

## Future Work (out of scope for Sprint 2)

- Distributed tracing (OpenTelemetry) for cross-service request traces.
- APM integration (Sentry/Vercel Analytics) — not required for v1.0 gate.
- DB-backed request log retention for post-incident forensics.
