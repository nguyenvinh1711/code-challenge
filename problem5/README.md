# Problem 5 — A Crude Server

A small CRUD HTTP API built with **Express 5** + **TypeScript**, with two
swappable storage backends:

- **SQLite** via `better-sqlite3` — default, zero-setup.
- **Postgres** via `drizzle-orm` + `pg.Pool` — production-ready, scales out.

Switch via `DB_DRIVER=sqlite|postgres`. Validation is handled by `zod`.

The resource modeled is a generic `Item` so the required "list with basic filters" endpoint is meaningful.

---

## Run it

From the **repo root** (not `problem5/`):

```bash
npm install
npm run solution5
# → problem5 HTTP Server listening on http://localhost:3000
```

Or run the entry file directly:

```bash
npx ts-node problem5/solution.ts
```

The SQLite file is created on first boot at `problem5/data/items.sqlite`.

### Seed test data

A seed script is provided to populate random items so all endpoints can be exercised immediately. It **respects `DB_DRIVER`** same command for both backends:

```bash
npm run solution5:seed                    # 20 items (default), into current driver
npm run solution5:seed -- 100             # custom count
npm run solution5:seed -- 50 --clear      # wipe existing items first, then seed 50
```

For Postgres, ensure migrations have run first (`npm run solution5:db:migrate`). 
The script refuses to run when `NODE_ENV=production`.

Names look like `"Quick Falcon Project #4823"` (random adjective + noun + suffix). IDs are auto-incrementing integers.

> Note: the seeder inserts one row at a time through the repository port
> (the same code path the HTTP API uses). That's fine up to a few thousand rows. 
> For very large datasets, use `pg_dump`/`COPY` (Postgres) or a dedicated bulk path.

---

## Configuration

`problem5/.env` is loaded automatically on boot (optional). See `problem5/.env.example` for the full list of variables.

| Env var          | Default                            | Description                          |
|------------------|------------------------------------|--------------------------------------|
| `PORT`           | `3000`                             | HTTP port                            |
| `DB_DRIVER`      | `sqlite`                           | `sqlite` or `postgres`               |
| `DB_PATH`        | `problem5/data/items.sqlite`       | SQLite file path (used when `DB_DRIVER=sqlite`). Use `:memory:` for an ephemeral DB. |
| `DATABASE_URL`   | _unset_                            | Postgres connection string (required when `DB_DRIVER=postgres`) |
| `PG_POOL_MAX`    | `10`                               | Max connections in `pg.Pool`         |
| `NODE_ENV`       | _unset_                            | When set to `test`, request logging is suppressed. |

### Run with Postgres

```bash
# 1. Start a Postgres (any way you like — Docker example):
docker run -d --rm --name pg-items -p 5432:5432 \
   -e POSTGRES_PASSWORD=secret -e POSTGRES_DB=items postgres:16-alpine

export DB_DRIVER=postgres
export DATABASE_URL=postgres://postgres:secret@localhost:5432/items

# 2. Apply schema migrations (one-shot; do NOT auto-run on app boot in prod):
npm run solution5:db:migrate

# 3. Boot the server:
npm run solution5
```

### Migrations workflow

Drizzle is the schema-as-source-of-truth. 
Edit `src/repositories/postgres/schema.ts` if necessary, then:

```bash
npm run solution5:db:generate   # diffs schema.ts vs prior migrations → emits SQL
npm run solution5:db:migrate    # applies pending migrations to DATABASE_URL
npm run solution5:db:studio     # optional GUI
```

The generated SQL is committed under `problem5/migrations/postgres/`.
Never edit a previously-applied migration; generate a new one.
The initial migration enables the `pg_trgm` extension required by the trigram GIN index on `lower(name)`.

---

## Data model

| Field       | Type             | Notes                              |
|-------------|------------------|------------------------------------|
| `id`        | integer          | server-assigned, auto-increment    |
| `name`      | string, 1..200   | required                           |
| `createdAt` | ISO-8601 string  | server-assigned                    |
| `updatedAt` | ISO-8601 string  | server-assigned                    |

---

## API reference

All requests and responses are JSON. Errors follow:
```json
{ "error": { "code": "ValidationError", "message": "...", "details": { ... } } }
```

### `POST /items` — create
Body: `{ name }`
```bash
curl -X POST localhost:3000/items \
  -H 'content-type: application/json' \
  -d '{"name":"buy milk"}'
```
→ `201 Created` + the created Item.

### `GET /items` — list with filters, pagination & sorting
Query params (all optional):

| Param    | Type    | Default       | Effect                                                      |
|----------|---------|---------------|-------------------------------------------------------------|
| `q`      | string  | —             | Case-insensitive substring match against `name`             |
| `limit`  | integer | `20` (1..100) | Page size                                                   |
| `page`   | integer | `1` (≥1)      | 1-based page number                                         |
| `sortBy` | enum    | `createdAt`   | One of `id`, `name`, `createdAt`, `updatedAt`               |
| `order`  | enum    | `desc`        | `asc` or `desc`                                             |

```bash
curl 'localhost:3000/items?q=falcon&page=2&limit=5&sortBy=name&order=asc'
```
→ `200 OK` with:
```json
{
  "data": [ /* Item[] */ ],
  "total": 47,
  "page": 2,
  "limit": 5,
  "totalPages": 10
}
```

### `GET /items/:id` — fetch one
```bash
curl localhost:3000/items/1
```
→ `200` + Item, or `404`.

### `PUT /items/:id` — update
Body: `{ name }` (must be non-empty).
```bash
curl -X PUT localhost:3000/items/1 \
  -H 'content-type: application/json' \
  -d '{"name":"renamed"}'
```
→ `200` + `{ status, message, item }`, or `404`. Empty body returns `400`.

### `DELETE /items/:id`
```bash
curl -X DELETE localhost:3000/items/1
```
→ `200` + `{ status, message }`, or `404`.

### `GET /health`
→ `200 { "ok": true }`.

---

## Error format

| Status | `code`              | When                                           |
|--------|---------------------|------------------------------------------------|
| 400    | `ValidationError`   | Body / query / params failed zod validation    |
| 404    | `NotFound`          | Resource id does not exist, or unknown route   |
| 500    | `InternalError`     | Unexpected error                               |

---

## Tests

In-memory SQLite + supertest, run with Node's built-in test runner:

```bash
npm run solution5:test
```

Coverage: health, full CRUD round-trip, list filters, page-based pagination, validation rejections.

---

## Project structure

```
problem5/
├── README.md
├── PLAN.md                    design doc
├── problem.md                 original brief
├── solution.ts                entry — `import './src/index'`
├── .env                       optional env overrides
├── data/                      SQLite file lives here (gitignored)
└── src/
    ├── index.ts               bootstrap (load .env → newApp → listen)
    ├── app.ts                 Express app factory
    ├── models/
    │   ├── items.model.ts     Item interface
    │   └── index.ts
    ├── schemas/
    │   ├── items.schema.ts    zod schemas + inferred input types
    │   └── index.ts
    ├── repositories/
    │   ├── interfaces.ts      IItemsRepository port
    │   ├── sqlite/
    │   │   ├── db.ts          better-sqlite3 driver + table DDL
    │   │   └── items.repository.ts   SQLite adapter
    │   └── index.ts
    ├── services/
    │   ├── interfaces.ts      IItemsService
    │   ├── items.service.ts   business-logic
    │   └── index.ts
    ├── routes/
    │   ├── items.routes.ts    /items router
    │   └── index.ts
    ├── middleware/
    │   ├── validate.ts        zod → 400 on failure
    │   ├── errors.ts          notFound + central error handler
    │   └── index.ts
    ├── utils/
    │   └── http-errors.ts     ApiError class
    ├── scripts/
    │   └── seed.ts            random data populator
    └── __tests__/
        └── items.test.ts      health + CRUD tests (simple integration tests to make sure the CRUD are working)
```

---

## Architecture in one diagram

```
HTTP request
    │
    ▼
routes/items.routes.ts  ──validate (zod)──▶  ItemsService  ──▶  IItemsRepository (port)
                                                                     │
                            ┌────────────────────────────────────────┤
                            ▼                                        ▼
            repositories/sqlite/items.repository.ts   repositories/postgres/items.repository.ts
            (better-sqlite3 — sync, file-based)       (drizzle-orm + pg.Pool)
                            │                                        │
                            ▼                                        ▼
            repositories/sqlite/db.ts                 repositories/postgres/db.ts
                                                      + repositories/postgres/schema.ts
```

- Routes, the service, and the model layer have **zero dependency on a specific driver**. They only know `IItemsRepository`.
- The `DB_DRIVER` env selects the adapter at boot via `src/config.ts` — the single registration point.
- To add another backend (e.g. MySQL, Mongo), implement `IItemsRepository` under `src/repositories/<driver>/` and add a `case` to `buildRepositories`.

---

## Design notes

- **Extensible, testable and maintainable**
  - I scaffolded the codebase as realistic as possible to be a real-world codebase. Using the Repository Pattern and the Dependency Inversion Principle. Other patterns will be used when needed later.
  - We also could structure by domain (e.g. `items`, `users`, `orders`, etc.) to support larger applications (as NestJS modules).
- **SQLite via `better-sqlite3`**
  - Zero setup for the reviewer; with synchronous API removes a category of async-error pitfalls.
  - Repository methods are still declared `async` to keep the interface backend-agnostic.
- **Auto-increment integer ids**
  - Simple and easier for ad-hoc curl/Postman testing than UUIDs.
- **No ORM needed.**
  - With minimal application, using an ORM library (like TypeORM or Sequelize) would add unnecessary complexity and extra dependencies. Direct SQL queries are used instead for simplicity.
- **`zod` middleware factory**
  - Validates body / query / params uniformly. For Express 5, `req.query` is read-only, so the parsed query is passed via `res.locals.query`.
- **Sort-column safety**
  - `sortBy` and `order` are zod enums, so interpolating them into the SQL `ORDER BY` clause is safe (no user-controlled strings reach the query).
- **Error envelope**
  - Is consistent across all 4xx/5xx paths — easy to consume.
- **In-memory DB for tests:**
  - Using SQLite database path `:memory:`, the database exists only in RAM for the duration of each test run. This ensures every test starts with a blank database and avoids the need to create or delete temporary files between test runs.

---

## Scaling notes (Postgres path)

The Postgres adapter is designed for production growth. Items below are ordered by when they typically start to matter:

1. **Connection pooling**
  - `pg.Pool` is per-process (`PG_POOL_MAX`, default 10). At many app instances × replicas, front Postgres with **pgBouncer
    in transaction mode**. Drizzle works with pgBouncer natively.
2. **`pg_trgm` GIN index on `lower(name)`**
  - Already in the initial migration. With the GIN index, most `ILIKE '%term%'` lookups are reduced from O(n) full scans to O(log n) index lookups (plus a small heap fetch). Without this index, such queries are O(n) and degrade quickly as table size grows.
3. **Total + page in one transaction**
  - The `list` method runs `count(*)` and the page select inside `db.transaction` so totals are accurate under concurrent writes.
4. **Read replicas**
  - When ready, point `READ_DATABASE_URL` at a replica and extend the adapter to route reads to a second pool. The repository contract doesn't change. For Drizzle ORM, read more about read replicas [here](https://orm.drizzle.team/docs/read-replicas).
5. **Migrations in CI/CD**
  - `npm run solution5:db:migrate` runs as a separate one-shot job before the app deploy NOT on app boot. 
   Make schema changes additive (add → backfill → dual-write → cut over → drop) to keep deploys zero-downtime.
6. **Keyset pagination**
  - For large datasets, consider keyset pagination (e.g. `WHERE id < @cursor ORDER BY id DESC`) instead of `OFFSET` to optimize performance, particularly if users frequently access deeper pages or if the data changes rapidly;
  - Also consider caching estimated total row counts rather than running a full `COUNT(*)` query each time, since counting all rows can be expensive at scale.
7. **Beyond >=10M rows (theoretical limit)** or time-bounded hot data
  - Partition `items` by `created_at` month range.
8. **Observability**
   - **Enable `pg_stat_statements`**: This is a PostgreSQL extension that tracks execution statistics for all SQL statements. It lets you see which queries are slow or run most frequently, making it easy to find performance bottlenecks.
   - **Scrape replica lag**: In high-availability setups with read replicas, it's important to monitor "replica lag" — the delay between writes on the primary and their appearance on replicas. Alert if lag grows unexpectedly, as stale replicas can return outdated data.
   - **Monitor pool saturation**: Keep an eye on your connection pool (like `pg.Pool`); if all connections are busy, new requests will queue or fail. Tracking pool usage helps you set correct pool sizes and spot unexpected load or resource exhaustion.
   - **Add a `/health/ready` endpoint**: Implement an HTTP endpoint (commonly called a "readiness probe") that pings the database connection pool and returns success/failure. Use this for orchestration tools (like Kubernetes or load balancers) to check if the service is healthy and ready to handle requests.
