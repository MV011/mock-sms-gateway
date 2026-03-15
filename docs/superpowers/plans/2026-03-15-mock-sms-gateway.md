# Mock SMS Gateway Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-hosted mock SMS gateway with web inbox, conversation threading, reply simulation, configurable delivery behaviors, MCP server, and CLI.

**Architecture:** Single-process Hono server serving both REST API and Vite-built React frontend. SQLite (better-sqlite3) for storage with configurable memory/file-backed modes. WebSocket for live UI updates. Bundled MCP server (stdio) and CLI wrapper for AI/CI integration.

**Tech Stack:** Hono, TypeScript, Vite, React 19, Tailwind CSS 4, better-sqlite3, @modelcontextprotocol/sdk (MCP), commander (CLI)

**Spec:** `docs/superpowers/specs/2026-03-15-mock-sms-gateway-design.md`

---

## Chunk 1: Project Scaffold + Database + Core API

### Task 1: Project Initialization

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.server.json`
- Create: `.gitignore`
- Create: `.node-version`

- [ ] **Step 1: Initialize project**

```bash
cd /Users/bogdan/repos/mock-sms-gateway
npm init -y
```

- [ ] **Step 2: Install server dependencies**

```bash
npm install hono @hono/node-server better-sqlite3 uuid
npm install -D typescript @types/node @types/better-sqlite3 @types/uuid tsx vitest
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist",
    "rootDir": ".",
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "src/client"]
}
```

- [ ] **Step 4: Create tsconfig.server.json**

```json
{
  "extends": "./tsconfig.json",
  "include": ["src/server/**/*.ts"]
}
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
dist/
*.db
.env
.DS_Store
```

- [ ] **Step 6: Create .node-version**

```
22
```

- [ ] **Step 7: Update package.json scripts**

Set `"type": "module"` and add scripts:
```json
{
  "dev": "tsx watch src/server/index.ts",
  "build:server": "tsc -p tsconfig.server.json",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: initialize project with TypeScript, Hono, and better-sqlite3"
```

---

### Task 2: Database Schema and Queries

**Files:**
- Create: `src/server/db/schema.ts`
- Create: `src/server/db/connection.ts`
- Create: `src/server/db/queries.ts`
- Test: `tests/db.test.ts`

- [ ] **Step 1: Write the failing test for database initialization**

Create `tests/db.test.ts` with tests for: phone_numbers table exists, messages table exists, settings table exists, 6 magic numbers seeded on first boot.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/db.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Create src/server/db/schema.ts**

SQLite schema with tables: `phone_numbers` (id, number UNIQUE, label, country_code, behavior CHECK constraint, behavior_config JSON, is_magic, pinned, timestamps), `messages` (id, phone_id FK ON DELETE SET NULL, phone_number, direction CHECK outbound/inbound, body, from_name, template_key, status CHECK, error_message, metadata JSON, webhook_status, created_at), `settings` (key PK, value JSON). Plus indexes on messages(phone_id, created_at DESC), messages(phone_number, created_at DESC), messages(created_at DESC), phone_numbers(number).

- [ ] **Step 4: Create src/server/db/connection.ts**

Creates database from storage path (`:memory:` or file), enables WAL mode and foreign keys, applies schema, seeds magic numbers.

- [ ] **Step 5: Create src/server/db/queries.ts**

Exports `seedMagicNumbers()` which inserts the 6 preset magic numbers (+40700000001 through +40700000006) with behaviors: deliver, fail, delay(3000ms), reject, rate_limit(5/3600s), timeout(30000ms). All marked `is_magic=1, pinned=1`. Skips if magic numbers already exist.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/db.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: database schema, connection, magic number seeding"
```

---

### Task 3: Phone Number CRUD Queries

**Files:**
- Modify: `src/server/db/queries.ts`
- Test: `tests/numbers.test.ts`

- [ ] **Step 1: Write failing tests for phone number CRUD**

Create `tests/numbers.test.ts` with tests for: creates a phone number, lists with pinned first, finds by E.164, updates label and behavior, deletes, rejects duplicates.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/numbers.test.ts`
Expected: FAIL — functions not exported

- [ ] **Step 3: Implement in queries.ts**

Export types `PhoneNumber`, `CreatePhoneNumberInput` and functions: `createPhoneNumber`, `getPhoneNumbers` (ORDER BY pinned DESC, created_at ASC), `getPhoneNumberById`, `getPhoneNumberByNumber`, `updatePhoneNumber`, `deletePhoneNumber`. Include `rowToPhoneNumber` helper that parses JSON fields and converts integer booleans.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/numbers.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: phone number CRUD queries with tests"
```

---

### Task 4: Message Queries

**Files:**
- Modify: `src/server/db/queries.ts`
- Test: `tests/messages.test.ts`

- [ ] **Step 1: Write failing tests for message queries**

Create `tests/messages.test.ts` with tests for: creates linked message, creates catch-all message, lists by phone_id, paginates, searches by body, lists catch-all, clears by phone_id, clears all.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/messages.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement message queries**

Export types `Message`, `CreateMessageInput`, `GetMessagesOptions`, `PaginatedMessages` and functions: `createMessage` (auto-links phone_id by looking up phone_number), `getMessageById`, `getMessages` (with WHERE builder for phone_id, catch_all, q LIKE, direction, status + LIMIT/OFFSET + COUNT for total), `clearMessages` (optional phone_id). Return `{ data, total, limit, offset }` envelope.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/messages.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: message CRUD queries with pagination, search, and catch-all"
```

---

### Task 5: Delivery Behavior Engine

**Files:**
- Create: `src/server/behaviors.ts`
- Test: `tests/behaviors.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/behaviors.test.ts` with tests for: deliver returns success, fail returns failure with custom/default error, delay waits then delivers (use 50ms for test), reject returns httpStatus 400, timeout returns failure after timeout_ms.

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement behavior engine**

Export `applyBehavior(behavior, config)` returning `BehaviorResult { success, status, error?, httpStatus?, timeout? }`. Max timeout capped at 120s. Rate limit check happens in route handler (if we reach applyBehavior for rate_limit, we're within limit).

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: delivery behavior engine with delay, fail, reject, timeout"
```

---

### Task 6: Rate Limit Tracker

**Files:**
- Create: `src/server/rate-limiter.ts`
- Test: `tests/rate-limiter.test.ts`

- [ ] **Step 1: Write failing tests**

Tests for: allows under limit, blocks after exceeding, resets on clear.

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement RateLimiter class**

In-memory Map of phone number to timestamp array. `check(phone, max, windowSeconds)` filters timestamps within window. `record(phone)` pushes current timestamp. `clear()` empties map.

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: in-memory rate limiter for rate_limit behavior"
```

---

### Task 7: Hono Server + Send Route

**Files:**
- Create: `src/server/index.ts`
- Create: `src/server/routes/send.ts`
- Create: `src/server/context.ts`
- Create: `tests/helpers.ts`
- Test: `tests/api/send.test.ts`

- [ ] **Step 1: Write failing tests for send endpoint**

Create `tests/api/send.test.ts` and `tests/helpers.ts` (createTestApp helper using in-memory DB). Tests for: delivers to known number, fails to fail-configured number, rejects to reject-configured number, delivers to unknown (catch-all), rejects missing body, rejects missing to.

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Create src/server/context.ts**

AppContext interface with db, rateLimiter, broadcast function.

- [ ] **Step 4: Create send route**

`src/server/routes/send.ts` — validates body (to, body required), looks up phone number, checks rate limit if applicable, applies behavior, creates message, broadcasts via WebSocket, returns result.

- [ ] **Step 5: Create Hono app entry**

`src/server/index.ts` — exports `createApp(db)` factory. Sets up CORS, optional API key auth middleware, routes. Conditional server startup when run directly.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/api/send.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: Hono server with POST /api/v1/send route and behavior integration"
```

---

### Task 8: Remaining API Routes

**Files:**
- Create: `src/server/routes/numbers.ts`
- Create: `src/server/routes/messages.ts`
- Create: `src/server/routes/reply.ts`
- Create: `src/server/routes/stats.ts`
- Create: `src/server/webhook.ts`
- Test: `tests/api/numbers.test.ts`
- Test: `tests/api/messages.test.ts`

- [ ] **Step 1: Write failing tests for numbers API**

Tests for: GET lists numbers, POST creates, PATCH updates, DELETE removes.

- [ ] **Step 2: Write failing tests for messages API**

Tests for: GET lists with pagination, GET catch_all, DELETE clears, POST /reset clears everything.

- [ ] **Step 3: Run tests to verify they fail**

- [ ] **Step 4: Implement webhook dispatcher**

`src/server/webhook.ts` — SSRF protection via WEBHOOK_ALLOWED_HOSTS pattern matching. POST with 10s timeout via AbortSignal.

- [ ] **Step 5: Implement numbers route**

CRUD + generate (random E.164 per country code). Broadcasts WebSocket events.

- [ ] **Step 6: Implement messages route**

GET with query params, GET by id, DELETE with optional phone_id.

- [ ] **Step 7: Implement reply route**

Creates inbound message, dispatches webhook if configured (per-request > DB settings > env), updates webhook_status on message.

- [ ] **Step 8: Implement stats and reset routes**

Stats: aggregate query for counts by status/direction/catch-all. Reset: delete all + re-seed magic numbers + clear rate limiter.

- [ ] **Step 9: Register all routes in index.ts**

- [ ] **Step 10: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: complete REST API — numbers, messages, reply, stats, reset routes"
```

---

## Chunk 2: Frontend (Vite + React)

### Task 9: Frontend Scaffold

**Files:**
- Create: `src/client/main.tsx`
- Create: `src/client/App.tsx`
- Create: `src/client/index.css`
- Create: `src/client/index.html`
- Create: `vite.config.ts`

- [ ] **Step 1: Install frontend dependencies**

```bash
npm install react react-dom react-router-dom
npm install -D @vitejs/plugin-react vite tailwindcss @tailwindcss/vite @types/react @types/react-dom concurrently
```

- [ ] **Step 2: Create vite.config.ts**

React plugin + Tailwind plugin. Root at `src/client`. Build output to `dist/client`. Dev proxy `/api` and `/ws` to `http://localhost:8026`.

- [ ] **Step 3: Create index.html, main.tsx, App.tsx, index.css**

Minimal React shell with Tailwind import, dark background, BrowserRouter.

- [ ] **Step 4: Add dev scripts**

`dev:client` (vite), `dev:server` (tsx watch), `dev` (concurrently both), `build:client` (vite build), `build` (server + client).

- [ ] **Step 5: Test scaffold starts**

Run vite dev, verify it loads without errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: Vite + React + Tailwind frontend scaffold"
```

---

### Task 10: API Client + WebSocket Hook

**Files:**
- Create: `src/client/lib/api.ts`
- Create: `src/client/hooks/useWebSocket.ts`

- [ ] **Step 1: Create API client**

Typed wrapper over fetch for all REST endpoints. Export types: PhoneNumber, Message, PaginatedMessages, SendResult, Stats, CreateNumberInput.

- [ ] **Step 2: Create WebSocket hook**

`useWebSocket(handlers)` — connects to `/ws`, dispatches events by type, auto-reconnects after 2s on close.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: API client and WebSocket hook for frontend"
```

---

### Task 11: Inbox Page (Sidebar + Conversation)

**Files:**
- Create: `src/client/components/Sidebar.tsx`
- Create: `src/client/components/Conversation.tsx`
- Create: `src/client/components/MessageBubble.tsx`
- Create: `src/client/components/ReplyComposer.tsx`
- Create: `src/client/pages/Inbox.tsx`

Use `frontend-design` or `ui-ux-pro-max` skill for styling. Match the spec mockup: dark GitHub-inspired theme (#010409 bg, #0d1117 sidebar, #4ecdc4 accents).

- [ ] **Step 1: Build Sidebar**

Phone number list with: search, pinned first, unread badges, last message preview, behavior indicators, catch-all bucket, active selection highlight.

- [ ] **Step 2: Build MessageBubble**

Outbound left-aligned (green), inbound right-aligned (blue). Shows body, metadata (template_key, status, from_name, webhook_status), timestamps. Date separators.

- [ ] **Step 3: Build ReplyComposer**

Text input + send button. Calls api.sendReply().

- [ ] **Step 4: Build Conversation**

Header + scrollable message list + reply composer. Auto-scroll on new messages.

- [ ] **Step 5: Build Inbox page**

Sidebar + Conversation layout. State management for selected number, messages, numbers list. WebSocket integration for live updates.

- [ ] **Step 6: Update App.tsx routes**

- [ ] **Step 7: Manual test**

Run dev, verify sidebar, conversation threading, live updates via curl, reply composer.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: inbox UI with sidebar, conversation threading, and reply composer"
```

---

### Task 12: Settings Page

**Files:**
- Create: `src/client/pages/Settings.tsx`
- Create: `src/client/components/NumberForm.tsx`

- [ ] **Step 1: Build NumberForm**

Add number form with: number input, label, country presets, behavior selector, behavior config fields, magic number presets.

- [ ] **Step 2: Build Settings page**

Phone number table, add form, webhook config, clear/reset buttons.

- [ ] **Step 3: Add route, manual test, commit**

```bash
git add -A
git commit -m "feat: settings page with phone number management and behavior config"
```

---

## Chunk 3: Docker, WebSocket Server, MCP, CLI

### Task 13: WebSocket Server

**Files:**
- Create: `src/server/routes/ws.ts`
- Modify: `src/server/index.ts`

- [ ] **Step 1: Implement WebSocket handler**

Using Hono's WebSocket support. Add/remove clients from the broadcast set.

- [ ] **Step 2: Register route, manual test, commit**

```bash
git add -A
git commit -m "feat: WebSocket server for live UI updates"
```

---

### Task 14: Static Serving + Docker

**Files:**
- Modify: `src/server/index.ts`
- Create: `Dockerfile`
- Create: `docker-compose.yml`

- [ ] **Step 1: Add static file serving**

Serve `dist/client` for non-API routes. SPA fallback to index.html.

- [ ] **Step 2: Create Dockerfile**

Multi-stage: builder (npm ci + build) → runner (npm ci --omit=dev + dist). Node 22 Alpine. Port 8026.

- [ ] **Step 3: Create docker-compose.yml**

Single service, port 8026, STORAGE=memory default, optional volume for persistence.

- [ ] **Step 4: Test Docker build and run**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: Docker build with static frontend serving"
```

---

### Task 15: MCP Server

**Files:**
- Create: `src/mcp/server.ts`
- Create: `src/mcp/tools.ts`

- [ ] **Step 1: Install MCP SDK**

```bash
npm install @modelcontextprotocol/sdk
```

- [ ] **Step 2: Implement tools**

8 tools wrapping REST API: sms_send, sms_list, sms_wait (polling with configurable interval/timeout), sms_reply, sms_create_number, sms_delete_number, sms_clear, sms_stats.

- [ ] **Step 3: Create MCP server entry**

stdio transport. Reads SMS_MOCK_URL env var.

- [ ] **Step 4: Add bin entry, test, commit**

```bash
git add -A
git commit -m "feat: MCP server with SMS testing tools"
```

---

### Task 16: CLI

**Files:**
- Create: `src/cli/index.ts`

- [ ] **Step 1: Install commander**

```bash
npm install commander
```

- [ ] **Step 2: Implement CLI commands**

Thin wrapper over REST API: send, messages, wait, reply, numbers (list/add/generate), clear, stats. Reads SMS_MOCK_URL env var.

- [ ] **Step 3: Add bin entry, test, commit**

```bash
git add -A
git commit -m "feat: CLI for mock SMS gateway"
```

---

### Task 17: README + Final Polish

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

What it is, quick start (Docker + npm), API reference, CLI usage, MCP integration, env vars table, magic numbers table.

- [ ] **Step 2: Run full test suite + build**

```bash
npm run test && npm run build
```

- [ ] **Step 3: Commit and push**

```bash
git add -A
git commit -m "docs: README with quickstart, API reference, and configuration guide"
git push -u origin main
```

---

## Execution Order

- **Chunk 1** (Tasks 1–8): Sequential — each builds on previous
- **Chunk 2** (Tasks 9–12): Sequential — depends on Chunk 1 complete
- **Chunk 3** (Tasks 13–17): Tasks 13–14 sequential, then 15 and 16 can be parallelized (both wrap REST API independently), then 17 last

## Parallelization Opportunities

| Independent Tasks | Why |
|---|---|
| Task 15 (MCP) + Task 16 (CLI) | Both wrap the same REST API, no shared state |
| Task 11 (Inbox) components (Sidebar, MessageBubble, ReplyComposer) | Independent UI components with defined interfaces |
