# Mock SMS Gateway

A self-hosted mock SMS gateway with a web inbox, conversation threading, reply simulation, and configurable delivery behaviors. Think Mailpit, but for SMS.

Drop-in replacement for real SMS providers (Twilio, SMSLink, etc.) in development and staging environments. Captures sent messages in a browsable web UI, simulates replies, and exposes an MCP server + CLI for AI-driven and CI testing workflows.

## Quick Start

### Docker (recommended)

```bash
# One command
docker run -p 8026:8026 ghcr.io/mv011/mock-sms-gateway

# Or with docker-compose
docker compose up
```

### Docker Compose with persistence

```yaml
services:
  sms-mock:
    build: .
    ports:
      - "8026:8026"
    environment:
      STORAGE: /data/sms.db
    volumes:
      - sms-data:/data

volumes:
  sms-data:
```

### npm (development)

```bash
git clone https://github.com/MV011/mock-sms-gateway.git
cd mock-sms-gateway
npm install
npm run dev
```

This starts both the API server (port 8026) and the Vite dev server with hot reload.

Open [http://localhost:5173](http://localhost:5173) for the UI (proxies API calls to 8026).

## API Reference

All endpoints are under `/api/v1`. JSON request/response bodies.

### Send & Reply

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/send` | Send an outbound SMS. Body: `{ to, body, from?, template_key?, metadata? }` |
| `POST` | `/api/v1/reply` | Simulate an inbound reply. Body: `{ from, body, webhook_url? }` |

### Messages

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/messages` | List messages. Query: `phone_id`, `catch_all`, `q`, `direction`, `status`, `limit`, `offset` |
| `GET` | `/api/v1/messages/:id` | Get a single message by ID |
| `DELETE` | `/api/v1/messages` | Clear messages. Query: `phone_id` (optional, clears all if omitted) |

### Phone Numbers

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/numbers` | List all phone numbers (pinned first) |
| `POST` | `/api/v1/numbers` | Register a number. Body: `{ number, label?, behavior?, behavior_config?, pinned? }` |
| `POST` | `/api/v1/numbers/generate` | Generate a random E.164 number. Body: `{ country_code? }` (default: US) |
| `PATCH` | `/api/v1/numbers/:id` | Update a number's label, behavior, etc. |
| `DELETE` | `/api/v1/numbers/:id` | Delete a phone number |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/stats` | Aggregate message statistics |
| `POST` | `/api/v1/reset` | Reset everything: clear messages, numbers, re-seed magic numbers, clear rate limits |
| `GET` | `/api/v1/health` | Health check (`{ status: "ok" }`) |

### WebSocket

Connect to `/ws` for live events. Events are JSON with `{ type, data }`:

- `message:new` -- new message sent or received
- `number:created`, `number:updated`, `number:deleted` -- phone number changes
- `messages:cleared` -- messages cleared
- `reset` -- full reset

### Authentication

If `API_KEY` is set, all `/api/*` requests must include the `X-API-Key` header.

## CLI

The CLI wraps the REST API for terminal and CI usage.

```bash
# Send a message
sms-mock send --to +40700000001 --body "Your code is 1234"

# List messages
sms-mock messages
sms-mock messages --phone +40700000001 --limit 10

# Wait for a message (useful in E2E tests)
sms-mock wait --phone +40700000001 --contains "code" --timeout 30

# Simulate a reply
sms-mock reply --from +40700000001 --body "Got it"

# Manage numbers
sms-mock numbers list
sms-mock numbers add --number +40712345678 --label "Test User" --behavior deliver
sms-mock numbers add --magic fail
sms-mock numbers generate --country RO
sms-mock numbers delete --id <uuid>

# Clear and reset
sms-mock clear                    # clear all messages
sms-mock clear --phone-id <uuid>  # clear messages for a number
sms-mock clear --reset            # full reset (re-seeds magic numbers)

# Statistics
sms-mock stats
```

Set `SMS_MOCK_URL` to point the CLI at a remote gateway (default: `http://localhost:8026`).

## MCP Integration

The MCP (Model Context Protocol) server enables AI agents (Claude Code, etc.) to interact with the SMS gateway via stdio transport.

### Configure in `.mcp.json`

```json
{
  "mcpServers": {
    "sms-mock": {
      "command": "node",
      "args": ["dist/mcp/server.js"],
      "env": {
        "SMS_MOCK_URL": "http://localhost:8026"
      }
    }
  }
}
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `sms_send` | Send an SMS message |
| `sms_list` | List messages with filters |
| `sms_wait` | Poll for a message matching criteria (key for E2E testing) |
| `sms_reply` | Simulate an inbound reply |
| `sms_create_number` | Register a phone number with behavior |
| `sms_delete_number` | Delete a phone number |
| `sms_clear` | Clear messages or full reset |
| `sms_stats` | Get message statistics |

## Configuration

All configuration is via environment variables.

| Variable | Default | Description |
|----------|---------|-------------|
| `STORAGE` | `memory` | `memory` for ephemeral or a file path (e.g. `/data/sms.db`) for persistence |
| `PORT` | `8026` | HTTP server port |
| `API_KEY` | _(none)_ | If set, requires `X-API-Key` header on all API requests |
| `WEBHOOK_URL` | _(none)_ | Default URL to POST inbound reply payloads to |
| `WEBHOOK_ALLOWED_HOSTS` | _(none)_ | Comma-separated host patterns for SSRF protection (e.g. `localhost,*.internal`) |
| `CORS_ORIGIN` | `*` | CORS allowed origins |
| `SMS_MOCK_URL` | `http://localhost:8026` | Used by CLI and MCP server to locate the gateway |
| `LOG_LEVEL` | `info` | Logging verbosity: `debug`, `info`, `warn`, `error` |

## Magic Numbers

Six preset phone numbers are seeded on first boot (and after reset). Use them to test different delivery scenarios without any configuration.

| Number | Label | Behavior | Config |
|--------|-------|----------|--------|
| `+40700000001` | Always Deliver | `deliver` | -- |
| `+40700000002` | Always Fail | `fail` | `error_message: "Simulated provider error"` |
| `+40700000003` | Slow Delivery (3s) | `delay` | `delay_ms: 3000` |
| `+40700000004` | Invalid Number | `reject` | `error_message: "Invalid phone number"` |
| `+40700000005` | Rate Limited (5/hr) | `rate_limit` | `max_messages: 5, window_seconds: 3600` |
| `+40700000006` | Timeout (30s) | `timeout` | `timeout_ms: 30000` |

Messages sent to unregistered numbers are delivered successfully and appear in the "Catch-all" bucket.

## Behavior Reference

| Behavior | Effect | Config Fields |
|----------|--------|---------------|
| `deliver` | Message delivered successfully (HTTP 200) | -- |
| `fail` | Message fails with error (HTTP 200, `status: "failed"`) | `error_message?: string` |
| `delay` | Waits, then delivers (HTTP 200 after delay) | `delay_ms: number` |
| `reject` | Rejected with HTTP 400 | `error_message?: string` |
| `rate_limit` | Allows N messages per window, then HTTP 429 | `max_messages: number, window_seconds: number` |
| `timeout` | Simulates provider timeout (HTTP 504) | `timeout_ms: number` (max 120s) |

## Architecture

Single-process Node.js application serving both the REST API and static frontend:

- **Hono** -- HTTP framework
- **React + Vite + Tailwind CSS 4** -- frontend (built at Docker image build time)
- **better-sqlite3** -- SQLite storage (memory or file-backed)
- **WebSocket (ws)** -- live UI updates
- **MCP SDK** -- AI agent integration via stdio
- **Commander** -- CLI

## License

MIT -- see [LICENSE](LICENSE).
