<!-- This flow chart is from README.md -->

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
