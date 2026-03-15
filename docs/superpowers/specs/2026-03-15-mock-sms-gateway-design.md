# Mock SMS Gateway — Design Spec

**Date:** 2026-03-15
**Status:** Draft
**Repo:** `mock-sms-gateway` (public, GitHub)
**Linear Team:** Tooling (build), SRV (deployment)

## Purpose

A standalone, self-hosted mock SMS gateway for development and staging environments. Acts as a drop-in replacement for real SMS providers (Twilio, SMSLink, etc.) — capturing sent messages in a browsable web inbox with conversation threading, reply simulation, and configurable delivery behaviors. Designed for reuse across multiple apps.

Think Mailpit, but for SMS.

## Non-Goals

- MMS / media messages
- Production SMS delivery
- Batch send endpoint (apps call `/send` per message; batch is out of scope for a mock)
- Mobile app

## Architecture

### Single-process Docker service

- **Hono** (TypeScript) serves the REST API and static frontend assets from one process
- **Vite + React** frontend built at Docker image build time, served by Hono as static files
- **SQLite** (via `better-sqlite3`) for message storage — configurable between `:memory:` (ephemeral) and file-backed (persistent)
- **WebSocket** (Hono native) for live UI updates when messages arrive
- **Single port** (default `:8026`) for both API and UI

### Environment

```
STORAGE=memory                    # or /data/sms.db for persistence
PORT=8026                         # HTTP port
WEBHOOK_URL=                      # optional: POST replies here
WEBHOOK_ALLOWED_HOSTS=            # optional: restrict webhook targets (comma-separated, e.g. "localhost,*.internal")
API_KEY=                          # optional: if set, all API requests must include X-API-Key header
CORS_ORIGIN=*                     # CORS allowed origins
LOG_LEVEL=info                    # debug | info | warn | error
SMS_MOCK_URL=http://localhost:8026  # used by CLI to locate the gateway
```

## Data Model

### Tables

```
phone_numbers
  id            TEXT PRIMARY KEY (uuid)
  number        TEXT UNIQUE NOT NULL    -- E.164 format
  label         TEXT                    -- "Patient Test", "Doctor Nord"
  country_code  TEXT                    -- "RO", "US"
  behavior      TEXT DEFAULT 'deliver'  -- deliver | fail | delay | reject | rate_limit | timeout
  behavior_config JSON                 -- see Behavior Config section below
  is_magic      BOOLEAN DEFAULT false   -- preset magic number
  pinned        BOOLEAN DEFAULT false
  created_at    TEXT NOT NULL
  updated_at    TEXT NOT NULL

messages
  id            TEXT PRIMARY KEY (uuid)
  phone_id      TEXT REFERENCES phone_numbers(id) -- null for catch-all
  phone_number  TEXT NOT NULL           -- denormalized for catch-all
  direction     TEXT NOT NULL           -- 'outbound' (app sends to phone) | 'inbound' (phone replies to app)
  body          TEXT NOT NULL
  from_name     TEXT                    -- sender name (maps from API's "from" field)
  template_key  TEXT                    -- results_ready, order_confirmation, etc.
  status        TEXT NOT NULL           -- delivered | failed | pending | rejected
  error_message TEXT
  metadata      JSON                   -- arbitrary key-value from the sending app
  webhook_status TEXT                   -- null | sent | failed (for replies)
  created_at    TEXT NOT NULL

settings
  key           TEXT PRIMARY KEY
  value         JSON NOT NULL
```

### Behavior Config

Each behavior type has specific config fields:

| Behavior | Config | Default |
|----------|--------|---------|
| `deliver` | none | — |
| `fail` | `{ error_message?: string }` | "Simulated provider error" |
| `delay` | `{ delay_ms: number }` | 3000 |
| `reject` | `{ error_message?: string }` | "Invalid phone number" |
| `rate_limit` | `{ max_messages: number, window_seconds: number }` | 5 msgs / 3600s |
| `timeout` | `{ timeout_ms: number }` | 30000 (max 120s, then drops connection) |

Rate limit counter is per phone number. Resets after `window_seconds` or on `POST /api/v1/reset`.

### Settings Keys

| Key | Type | Description |
|-----|------|-------------|
| `webhook_url` | string | Default webhook URL for reply callbacks |
| `webhook_allowed_hosts` | string[] | Allowed webhook target hosts |

### Magic Number Presets

Seeded on first boot (can be removed/re-added via UI):

| Number | Label | Behavior |
|--------|-------|----------|
| `+40700000001` | Always Deliver | `deliver` |
| `+40700000002` | Always Fail | `fail` |
| `+40700000003` | Slow Delivery (3s) | `delay` (3000ms) |
| `+40700000004` | Invalid Number | `reject` |
| `+40700000005` | Rate Limited (5/hr) | `rate_limit` (5 per 3600s) |
| `+40700000006` | Timeout (30s) | `timeout` (30000ms) |

Numbers are created with `is_magic = true` and `pinned = true`.

### Indexes

- `messages(phone_id, created_at DESC)` — conversation loading
- `messages(phone_number, created_at DESC)` — catch-all queries
- `messages(created_at DESC)` — global search
- `phone_numbers(number)` — lookup on receive

## API

### SMS Receive (used by apps)

```
POST /api/v1/send
Content-Type: application/json

{
  "to": "+40712345678",
  "body": "Rezultatele dvs. sunt disponibile.",
  "from": "PoliCircuit",          // optional sender name
  "template_key": "results_ready", // optional
  "metadata": { ... }              // optional, stored as-is
}

Response 200:
{
  "success": true,
  "message_id": "uuid",
  "status": "delivered",          // or "failed", "rejected" based on behavior
  "to": "+40712345678"
}

Response 200 (configured to fail):
{
  "success": false,
  "message_id": "uuid",
  "status": "failed",
  "error": "Simulated provider error"
}
```

Behavior rules applied:
- **deliver**: immediate success
- **fail**: returns `success: false` with configurable error message
- **delay**: holds response for `delay_ms`, then delivers
- **reject**: returns 400 with "Invalid phone number"
- **rate_limit**: delivers first `max_messages` within `window_seconds`, then returns 429
- **timeout**: holds connection for `timeout_ms` (max 120s), then drops connection without responding

Unknown numbers (not in `phone_numbers` table) are delivered to the catch-all bucket.

### Phone Number Management

```
GET    /api/v1/numbers              -- list all numbers
POST   /api/v1/numbers              -- create number { number, label, country_code, behavior, behavior_config }
PATCH  /api/v1/numbers/:id          -- update label, behavior, pinned
DELETE /api/v1/numbers/:id          -- remove number (sets phone_id=null on messages, preserves in catch-all)
POST   /api/v1/numbers/generate     -- generate random E.164 number for country { country_code: "RO" } → returns created number
```

### Messages

```
GET    /api/v1/messages                    -- list all, paginated, searchable
GET    /api/v1/messages?phone_id=:id       -- conversation for a number
GET    /api/v1/messages?catch_all=true     -- catch-all bucket
GET    /api/v1/messages/:id                -- single message
DELETE /api/v1/messages                    -- clear all
DELETE /api/v1/messages?phone_id=:id       -- clear conversation
```

Query params: `?q=search&limit=50&offset=0&direction=outbound|inbound&status=delivered|failed`

#### Pagination Response Envelope

All list endpoints return:
```json
{
  "data": [...],
  "total": 142,
  "limit": 50,
  "offset": 0
}
```

### Reply Simulation

```
POST /api/v1/reply
{
  "from": "+40712345678",    -- the phone number "replying"
  "body": "STOP",
  "webhook_url": "http://localhost:3000/api/sms/webhook"  -- optional override
}
```

Webhook URL precedence: per-request `webhook_url` > `settings.webhook_url` (DB) > `WEBHOOK_URL` env. If none is set, the reply is stored but no webhook fires. If `WEBHOOK_ALLOWED_HOSTS` is set, the target host must match or the webhook is rejected (SSRF protection for staging).

When a webhook URL is resolved, the gateway POSTs:
```
POST {webhook_url}
{
  "from": "+40712345678",
  "body": "STOP",
  "message_id": "uuid",
  "timestamp": "2026-03-15T14:47:00Z"
}
```

### Utilities

```
GET    /api/v1/stats                -- message counts, delivery stats
POST   /api/v1/reset                -- clear all data (messages + numbers)
GET    /api/v1/health               -- health check
```

### WebSocket

```
ws://localhost:8026/ws

Events pushed to connected clients:
{ "type": "message:new", "data": { ...message } }
{ "type": "message:status", "data": { id, status } }
{ "type": "number:created", "data": { ...number } }
{ "type": "number:updated", "data": { ...number } }
{ "type": "number:deleted", "data": { id } }
{ "type": "messages:cleared", "data": { phone_id: "..." | null } }
{ "type": "reset", "data": {} }
```

## Frontend (Vite + React)

### Pages

1. **Inbox** (default) — sidebar with phone numbers + conversation view
2. **Settings** — phone number management, webhook config, magic number presets
3. **Catch-All** — messages to unrecognized numbers

### Inbox Layout

- **Left sidebar** (280px):
  - Search bar (filters across all messages)
  - Phone number list with: label, number, unread count, last message preview, time
  - Pinned numbers at top
  - Magic numbers with behavior indicators (⚡ fail, 🐢 delay, 🚫 reject)
  - Catch-all bucket at bottom with unmatched message count
  - Add number button, settings link, clear all

- **Right panel** (flex):
  - Conversation header: label, number, behavior status, config button
  - Message thread: chat-style bubbles
    - Left: outbound from app (green icon) — shows body, template_key, status, timestamp, from_name
    - Right: inbound replies (blue icon) — shows body, webhook status, timestamp
  - Date separators between message groups
  - Reply composer at bottom: text input + send button

### Tech

- React 19 with TypeScript
- Tailwind CSS 4 for styling
- Dark theme (GitHub-dark inspired, as shown in mockup)
- WebSocket hook for live updates
- React Router for pages

## MCP Server

Bundled MCP server for AI agent integration. Exposed as stdio transport.

### Tools

```
sms_send          -- send an SMS to the gateway (test helper)
sms_list          -- list messages for a phone number
sms_wait          -- poll until a message matching criteria arrives (with timeout)
sms_reply         -- simulate a reply from a phone number
sms_create_number -- create a phone number with label and behavior
sms_delete_number -- remove a phone number
sms_clear         -- clear all messages (or per number)
sms_stats         -- get delivery statistics
```

`sms_wait` is the key tool for E2E testing. Parameters: `phone` (required), `body_contains` (optional pattern), `direction` (default: outbound), `timeout_ms` (default: 10000). Uses WebSocket internally to listen for `message:new` events. Returns the matching message on success, or an error on timeout.

## CLI

Thin wrapper over the REST API. Installed via npm or used via npx.

```bash
# Send a test message
sms-mock send --to +40712345678 --body "Test message" --from MyApp

# List messages for a number
sms-mock messages --phone +40712345678

# Wait for a message (E2E testing)
sms-mock wait --phone +40712345678 --contains "rezultate" --timeout 10s

# Reply
sms-mock reply --from +40712345678 --body "STOP"

# Manage numbers
sms-mock numbers list
sms-mock numbers add --number +40712345678 --label "Patient"
sms-mock numbers add --magic fail    # add magic fail number
sms-mock numbers generate --country RO

# Admin
sms-mock clear
sms-mock stats
```

## Docker

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build          # builds both Hono server and Vite frontend

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
EXPOSE 8026
ENV STORAGE=memory
CMD ["node", "dist/server.js"]
```

### docker-compose usage (in consuming apps)

```yaml
services:
  sms-mock:
    image: ghcr.io/etcseen/mock-sms-gateway:latest  # or build from source
    ports:
      - "8026:8026"
    environment:
      STORAGE: memory
      WEBHOOK_URL: http://app:3000/api/sms/webhook
    volumes:
      - sms-data:/data  # optional, for persistent mode
```

## Integration with PoliCircuit

Add a new `gateway` SMS provider in `lib/sms/providers/gateway.ts`:

```typescript
const gatewaySMSProvider: SMSProvider = {
  id: "gateway",
  info: { name: "Mock Gateway", ... },
  async send(message, config) {
    const res = await fetch(`${config.settings.gateway_url}/api/v1/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: message.to,
        body: message.body,
        from: config.settings.sender_name,
        template_key: message.templateKey,
        metadata: message.metadata,
      }),
    });
    const data = await res.json();
    return { success: data.success, ... };
  },
  ...
};
```

Set `SMS_PROVIDER=gateway` + `SMS_GATEWAY_URL=http://localhost:8026` in `.env.local`.

## Project Structure

```
mock-sms-gateway/
├── src/
│   ├── server/
│   │   ├── index.ts              -- Hono app entry
│   │   ├── routes/
│   │   │   ├── send.ts           -- POST /api/v1/send
│   │   │   ├── messages.ts       -- message CRUD
│   │   │   ├── numbers.ts        -- phone number CRUD
│   │   │   ├── reply.ts          -- reply simulation
│   │   │   ├── stats.ts          -- statistics
│   │   │   └── ws.ts             -- WebSocket handler
│   │   ├── db/
│   │   │   ├── schema.ts         -- SQLite schema + migrations
│   │   │   └── queries.ts        -- prepared statements
│   │   ├── behaviors.ts          -- delivery behavior engine
│   │   └── webhook.ts            -- outbound webhook dispatcher
│   ├── client/                   -- Vite + React frontend
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Inbox.tsx
│   │   │   ├── Settings.tsx
│   │   │   └── CatchAll.tsx
│   │   ├── components/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Conversation.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── ReplyComposer.tsx
│   │   │   ├── NumberList.tsx
│   │   │   └── NumberForm.tsx
│   │   └── hooks/
│   │       ├── useWebSocket.ts
│   │       └── useMessages.ts
│   ├── mcp/
│   │   ├── server.ts             -- MCP stdio server
│   │   └── tools.ts              -- tool definitions
│   └── cli/
│       └── index.ts              -- CLI entry
├── Dockerfile
├── docker-compose.yml            -- standalone dev usage
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── README.md
```

## Deployment

### Local development
```bash
npm run dev     # starts Hono + Vite in dev mode
```

### Docker (local or staging)
```bash
docker compose up sms-mock
```

### Coolify (staging)
Deploy as a Docker service. Expose on a subdomain (e.g., `sms.staging.policircuit.ro`). Create SRV team ticket for deployment setup.

## Success Criteria

1. An app can POST to `/api/v1/send` and see the message appear in the web inbox within 1 second
2. A tester can browse conversations per phone number, see message content and metadata
3. A tester can reply from the UI and the app receives the webhook callback
4. Magic/configured numbers produce the expected failure behaviors
5. An AI agent can use MCP tools to send, wait, assert, and clean up SMS in E2E tests
6. Docker image is under 150MB and starts in under 2 seconds
