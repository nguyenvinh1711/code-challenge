# Problem 6 — Live Scoreboard Module Specification

> Specification for a backend module that powers a website's top-10 live scoreboard. This document combines a **PRD** (problem framing, user stories, scope, testing) with a **technical specification** (architecture, API, data model, security) so the implementing team has a single source of truth.

---

## Part A — Product Requirements

### 1. Problem Statement

Our website displays a top-10 user scoreboard that must update **live** as users complete actions. Two product risks must be managed:

1. **Consistency** — viewers must see an accurate, real-time ranking.
2. **Integrity** — malicious users must not be able to inflate their own (or anyone else's) score by forging or replaying API calls.

### 2. Solution Overview

A **server-authoritative** scoring service:

- Scores are increased only by the backend, never by values supplied by the client.
- Every score change is gated by a **one-time, server-signed action token** issued at the start of the action and redeemed when the action completes.
- The leaderboard is held in a Redis sorted set for O(log N) updates and instant top-10 reads. A durable history is persisted to Postgres for audit and recovery.
- Connected viewers receive live top-10 updates over **Server-Sent Events** (SSE) fanned out via Redis Pub/Sub.

### 3. User Stories

1. As a **visitor**, I want to see the top-10 scoreboard on page load, so that I immediately know who is leading.
2. As a **visitor**, I want the scoreboard to update without refreshing, so that I see ranking changes as they happen.
3. As a **visitor**, I want updates to arrive within ~1 second of any qualifying score change, so that the board feels live.
4. As an **authenticated user**, I want to start an action and receive an action token, so that the server can later credit me for completing it.
5. As an **authenticated user**, I want my score to increase after completing an action, so that I am rewarded for participation.
6. As a **product owner**, I want unauthenticated score-update requests to be rejected, so that anonymous attackers cannot inflate scores.
7. As a **product owner**, I want replays of a captured score-update request to be rejected, so that an attacker who sniffs one valid call cannot reuse it.
8. As a **client developer**, I want safe network retries on the update endpoint, so that a transient failure plus retry never double-credits the user.
9. As a **product owner**, I want every score change to be auditable to `(user, action, timestamp, delta)`, so that disputes and abuse can be investigated.
10. As a **visitor**, I want my live feed to seamlessly resume after a brief disconnect, so that I don't miss the latest top-10.
11. As an **operator**, I want per-user rate limits on score updates, so that scripted abusers are throttled even if their tokens are individually valid.
12. As an **operator**, I want a degraded but correct top-10 read when Redis is unavailable, so that the public-facing board never goes blank.

### 4. Out of Scope

- Frontend implementation; this is a backend module specification.
- The "action" itself — this spec only covers the scoring/auth/broadcast contract.
- Score ties UX (we will accept Redis ZSET tie-breaking by lexicographic member order).
- Behavioral anti-cheat beyond authentication, single-use tokens, and rate limiting (e.g. duration heuristics, device fingerprinting). Listed in *Improvements*.
- Historical, regional, friend-only, or per-game leaderboards. Listed in *Improvements*.

### 5. Implementation Decisions (high level)

- **Server is the sole authority on score deltas.** Clients never send "I earned X points." The server looks up the reward by `actionId` server-side.
- **Authorization is layered:** JWT session (proves *who*) + one-time action token (proves *that this specific action completed*) + idempotency key (prevents double-credit on retry).
- **Live transport is SSE.** WebSocket is documented as an alternative — see §11 below for the trade-off analysis.
- **Storage is Redis ZSET (live) + Postgres (durable audit).** Redis is the source of truth for the live ranking; Postgres is the source of truth for history.
- **Top-10 broadcast is event-driven**, not polled. After every successful score update, the API publishes to a Redis Pub/Sub channel; SSE workers receive it and push to subscribers.
- **Per-user rate limiting** on `/actions/start` and `/scores/update` (token bucket).
- **Periodic reconcile** every 30s rebroadcasts the authoritative top-10 to defend against missed pub/sub events.

### 6. Testing Decisions

Tests target **observable external behavior** of the public API and live feed, not internal helpers. Suggested suites:

- **Auth tests:** unauthenticated and JWT-expired requests are rejected with 401.
- **Action-token tests:** missing token → 400; expired token → 401; reused token → 409; token bound to a different user → 403.
- **Idempotency tests:** two `POST /scores/update` calls with identical `Idempotency-Key` produce one score change and identical responses.
- **Ordering tests:** after N concurrent updates, `GET /scores/top` returns the correct top-10 (as stored in Redis ZSET).
- **Broadcast tests:** an SSE subscriber receives a `top10` event within a defined Service Level Agreement (SLA)—for example, within 1 second—after a qualifying update. This ensures that users experience near real-time leaderboard updates and validates that the event-driven system reliably delivers updates within the expected latency bounds.
- **Reconnect test:** an SSE client that disconnects and reconnects with `Last-Event-ID` does not miss the latest top-10.
- **Failure-mode test:** with Redis disabled, `GET /scores/top` still returns a correct (slower) result via Postgres fallback.
- **Rate-limit test:** bursts above the configured rate are rejected with 429.

---

## Part B — Technical Specification

### 7. Architecture & Execution Flow

```mermaid
sequenceDiagram
    autonumber
    participant C as Client (Browser)
    participant API as API Service
    participant AUTH as Auth (JWT)
    participant R as Redis (ZSET + Pub/Sub)
    participant PG as Postgres
    participant SSE as SSE Workers

    Note over C,API: 1. User authenticated; holds JWT.

    C->>API: POST /actions/start  (JWT)
    API->>AUTH: verify JWT
    API->>PG: INSERT action_tokens(jti, user_id, action_id, expires_at)
    API-->>C: Return 200 with { actionToken }   (HMAC-signed, TTL 30s)

    Note over C: Upon completion the user's action, the client will dispatch an API call to update the score.

    C->>API: POST /scores/update  (JWT, Idempotency-Key, {actionToken})
    API->>AUTH: verify JWT
    API->>API: verify HMAC + decode actionToken
    API->>PG: UPDATE action_tokens SET redeemed_at=now() WHERE jti=? AND redeemed_at IS NULL
    alt token already redeemed or expired
        API-->>C: Return 409 Conflict / 401 Unauthorized
    else valid
        API->>API: lookup reward delta for action_id (server-side table)
        API->>PG: INSERT score_events(user_id, action_id, delta, idempotency_key UNIQUE)
        API->>R: ZINCRBY leaderboard delta user_id
        API->>R: PUBLISH leaderboard.updates {userId, newScore}
        API-->>C: Return 200 with updated data { userId, displayName, score }
    end

    R-->>SSE: pub/sub event
    SSE->>R: ZREVRANGE leaderboard 0 9 WITHSCORES
    SSE-->>C: Send event: top10 with data: {userId, displayName, score, rank...}   (to all subscribers)

    Note over SSE: Periodic 30s reconcile pushes the authoritative top-10 to defend against missed events.
```



### 8. Data Model

**Postgres**


| Table           | Columns                                                                                | Notes                                                               |
| --------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `users`         | `id PK`, `display_name`, `created_at`                                                  | Standard user table.                                                |
| `actions`       | `id PK`, `reward_delta`, `enabled`                                                     | Server-side reward catalog. **Clients never see `reward_delta`.**   |
| `action_tokens` | `jti PK`, `user_id FK`, `action_id FK`, `expires_at`, `redeemed_at NULLABLE`           | One row per issued action token; `redeemed_at` enforces single-use. |
| `score_events`  | `id PK`, `user_id FK`, `action_id FK`, `delta`, `created_at`, `idempotency_key UNIQUE` | Immutable audit log; `UNIQUE` index makes retries safe.             |


**Redis**


| Key                   | Type                                     | Purpose                                                                   |
| --------------------- | ---------------------------------------- | ------------------------------------------------------------------------- |
| `leaderboard`         | ZSET (member = `user_id`, score = total) | Live ranking. `ZINCRBY` on update; `ZREVRANGE 0 9 WITHSCORES` for top-10. |
| `leaderboard.updates` | Pub/Sub channel                          | Carries `{userId, newScore}` after every successful update.               |
| `ratelimit:{userId}`  | Token bucket                             | Per-user request quota.                                                   |


### 9. API Contract

All endpoints require `Authorization: Bearer <JWT>` unless noted. All errors follow `{ "error": { "code": string, "message": string } }`.

#### `POST /actions/start`

Issues a single-use action token. Rate-limited per user.

- **Request:** `{ "actionId": string }`
- **Response 200:** `{ "actionToken": string, "expiresAt": ISO8601 }`
- **Errors:** 401 (no/invalid JWT), 404 (unknown actionId), 409 (action disabled), 429 (rate-limited).

#### `POST /scores/update`

Redeems an action token and increments the user's score. **Idempotent.**

- **Headers:** `Authorization`, `Idempotency-Key` (required, client-generated UUID).
- **Request:** `{ "actionToken": string }`
- **Response 200:** `{ "userId": string, "displayName": string, "score": number }`
- **Errors:**
  - 400 — missing fields
  - 401 — bad/expired JWT, expired action token
  - 403 — action token's `userId` ≠ JWT user
  - 409 — action token already redeemed, or `Idempotency-Key` reused with a different body
  - 429 — rate-limited

#### `GET /scores/top`

Snapshot of the current top-10. Cacheable for ~1s; ETag header caching is supported.

- **Response 200:** `{ "top10": [{ "userId": string, "displayName": string, "score": number, "rank": number }, ...] }`

#### `GET /scores/stream`

SSE feed. Pushes the full top-10 on every change and on a 30s heartbeat/reconcile.

- **Headers (request):** `Accept: text/event-stream`, `Last-Event-ID` (optional, for resume).
- **Events:**
  - `event: top10` — `data: [{userId, displayName, score, rank}, ...]`
  - `event: heartbeat` — `data: {ts}` sent every 15 seconds to keep intermediary network proxies and clients from closing idle SSE (Server-Sent Events) connections. The `ts` field contains a timestamp.
- **Notes:** Each event has an increasing `id` so reconnects with `Last-Event-ID` can be served the latest snapshot.

### 10. Security


| Layer                         | Mechanism                                                                                       | What it stops                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 1. Authentication             | JWT on every endpoint                                                                           | Anonymous score updates                           |
| 2. Action-bound authorization | One-time, HMAC-signed action token; `jti` redeemed in DB; 30s TTL; bound to `userId + actionId` | Fabricated/replayed updates without a real action |
| 3. Retry safety               | Required `Idempotency-Key`, UNIQUE in `score_events`                                            | Double-credit from network retries or client bugs |
| 4. Volume                     | Per-user token-bucket rate limits on `/actions/start` and `/scores/update`                      | Scripted abuse with valid tokens                  |
| 5. Server authority           | Server alone decides the score delta from `actions.reward_delta`                                | Clients claiming arbitrary point values           |
| 6. Transport                  | TLS everywhere, including SSE                                                                   | Wire sniffing                                     |


### 11. Live-Update Transport: SSE vs WebSocket

**SSE (chosen):**

- One-way feed exactly fits a read-only public board — clients never need to push back over the same channel.
- Native browser `EventSource` with built-in auto-reconnect and `Last-Event-ID` resume.
- Plain HTTP/1.1 (or HTTP/2): traverses proxies and standard L7 load balancers without sticky sessions or special upgrade handling.
- Fewer moving parts in operations: no need to maintain a separate gateway or handle WebSocket upgrade negotiation.

**WebSocket (alternative) — pros:**

- Full-duplex; lower per-message framing overhead at sustained high frequency.
- Broader ecosystem of off-the-shelf infrastructure (e.g. managed gateways, presence systems).

**WebSocket — cons for this requirement:**

- Upstream channel from client to server is unused; we'd be paying for capability we don't need.
- Often requires sticky sessions / connection-draining strategies on deploy.
- Manual ping/pong heartbeat is required to keep idle connections alive.
- Some corporate proxies still strip the `Upgrade` header, breaking the connection invisibly.

**Decision:** start with SSE. Reconsider WebSocket only if the product gains bidirectional needs (e.g. live chat on the board, presence, client-initiated subscriptions to specific users) or sustained per-client message rates exceed ~10/s.

### 12. Failure Modes & Recovery

**Design principle: Postgres is the source of truth; Redis is a derived cache.** Redis is fast and convenient for ranking and fan-out, but the system must remain correct and writable when Redis is unavailable. To achieve this, score updates are written to Postgres + an outbox in one transaction, and a background worker drains the outbox to Redis. Redis can be lost entirely and the leaderboard can be rebuilt from `score_events`.

**Write path with transactional outbox:**

```
BEGIN
  INSERT INTO score_events  (..., idempotency_key UNIQUE)
  INSERT INTO outbox        (event_id, payload)        -- same transaction
COMMIT
→ background worker: ZINCRBY leaderboard + PUBLISH leaderboard.updates,
                     then DELETE the outbox row
```

If Redis is down, the outbox queue grows and drains automatically when Redis returns. Writes never block on Redis; there is no Redis/Postgres drift to compensate for.


| Failure                                        | Behavior                                                                                                                                                                                                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Redis unavailable (writes)**                 | Outbox absorbs all updates; API still returns 200. Worker retries with backoff and drains when Redis returns.                                                                                                                            |
| **Redis unavailable (reads)**                  | Circuit breaker on `ZREVRANGE` failures routes `GET /scores/top` to a Postgres aggregate (`SELECT user_id, SUM(delta) ... GROUP BY user_id ORDER BY 2 DESC LIMIT 10`), cached in-process for ~1s. Slower (seconds vs ms), still correct. |
| **Redis unavailable (live feed)**              | No pub/sub fan-out. SSE workers degrade to the 30s periodic reconcile against the Postgres fallback query. Latency degrades from ~1s to ~30s; feed never goes blank.                                                                     |
| **Redis unavailable (rate limit)**             | `/scores/update` and `/actions/start` fail-closed (503 + `Retry-After`) — abuse risk is highest exactly when controls are missing. Read-only endpoints fail-open.                                                                        |
| **Redis Pub/Sub event lost**                   | 30s periodic reconcile rebroadcasts the authoritative top-10 from the current source (ZSET if healthy, Postgres aggregate if not).                                                                                                       |
| **Redis data lost (full flush / new cluster)** | Run the cold-rebuild runbook (below); leaderboard is fully recoverable from `score_events`.                                                                                                                                              |
| **SSE client disconnect**                      | Reconnect with `Last-Event-ID`; server replays the latest top-10 immediately.                                                                                                                                                            |
| **Postgres unavailable**                       | Hard dependency — return 5xx. This is a real outage, not a degradation. Mitigated at infra layer (HA Postgres).                                                                                                                          |
| **Action token DB row missing on redeem**      | Treat as expired/forged → 401.                                                                                                                                                                                                           |


**Cold-rebuild runbook (Redis lost or replaced):**

1. Pause the outbox worker.
2. `DEL leaderboard` (start clean).
3. Rebuild from Postgres in one pass:
  ```sql
   SELECT user_id, SUM(delta) AS score FROM score_events GROUP BY user_id;
  ```
   For each row: `ZADD leaderboard <score> <user_id>`.
4. Resume the outbox worker — any updates that arrived during rebuild drain in order.
5. Trigger a reconcile broadcast so live clients receive the rebuilt top-10.

**Infra-level risk reduction:** run Redis with replicas + automatic failover (Sentinel / Cluster / managed Redis). This turns "Redis down" from a minutes-to-hours incident into a seconds-long blip that the outbox absorbs without user-visible impact.

### 13. Operational Concerns

- **Observability:** counters for token issued / redeemed / rejected, p50/p99 update latency, SSE subscriber count, broadcast lag (publish→client receive), reconcile drift.
- **Config:** action token TTL, rate-limit thresholds, reconcile interval, heartbeat interval — all environment-driven.
- **Deployment:** SSE workers can scale horizontally behind a sticky-session-free LB because state lives in Redis; the API is stateless.

### 14. Improvements / Future Work

1. **Anti-cheat heuristics:** minimum/maximum action duration, device fingerprinting, anomaly detection on score velocity.
2. **Write-ordering hardening:** evaluate Postgres-first / Redis-second to make Postgres the durable oracle and Redis a derived view rebuilt on cold start.
3. **Regional / friend / per-game leaderboards** as additional ZSETs.
4. **Signed audit log stream** for compliance — append-only, hash-chained.
5. **Admin tooling** for clawbacks and disputes, with a paired `score_adjustments` table.
6. **Migration path to WebSocket** if bidirectional features arrive — abstract the live-feed publisher behind a transport-agnostic interface from day one to make this swap cheap.
7. **Top-N parameterization** — current spec hardcodes 10, but the underlying ZSET trivially supports any N.
8. **Schema-validate every request** with Zod (or equivalent) to catch malformed payloads at the boundary.

