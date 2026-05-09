# Problem 5 — A Crude Server

A small CRUD HTTP API built with **Express 5** + **TypeScript**, persisted to
**SQLite** via `better-sqlite3`. Validation is handled by `zod`.

The resource modeled is a generic `Item` so the required "list with basic
filters" endpoint is meaningful.

---

## Run it

From the **repo root** (not `problem5/`):

```bash
npm install
npm run solution5
# → problem5 server listening on http://localhost:3000
```

Or run the entry file directly:

```bash
npx ts-node problem5/solution.ts
```

The SQLite file is created on first boot at `problem5/data/items.sqlite`.

### Seed test data

A seed script is provided to populate random items so all endpoints can be
exercised immediately:

```bash
npm run solution5:seed            # 20 items (default)
npm run solution5:seed -- 100     # custom count
```

Names look like `"Quick Falcon Project #4823"` (random adjective + noun +
suffix). IDs are auto-incrementing integers, so after seeding you can hit
`/items/1`, `/items/2`, … without copying UUIDs.

---

## Configuration

`problem5/.env` is loaded automatically on boot (optional).

| Env var    | Default                            | Description                          |
|------------|------------------------------------|--------------------------------------|
| `PORT`     | `3000`                             | HTTP port                            |
| `DB_PATH`  | `problem5/data/items.sqlite`       | SQLite file path. Use `:memory:` for an ephemeral DB. Empty string falls back to default. |
| `NODE_ENV` | _unset_                            | When set to `test`, request logging is suppressed. |

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

Coverage: health, full CRUD round-trip, list filters, page-based pagination,
validation rejections.

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
                                                                     ▼
                                                  repositories/sqlite/items.repository.ts
                                                                     │
                                                                     ▼
                                                  repositories/sqlite/db.ts
                                                  (better-sqlite3 driver)
```

Routes, the service, and the model layer have **zero dependency on
better-sqlite3**. They only know `IItemsRepository`. To add another backend
(e.g. Postgres), implement `IItemsRepository` under `src/repositories/<driver>/`
and wire it once in `src/app.ts`. The same manner applies to the service layer (business logic layer).

---

## Design notes

- **Extensible, testable and maintainable** — I scaffolded the codebase as realistic as possible to be a real-world codebase. Using the Repository Pattern and the Dependency Inversion Principle. Other patterns will be used when needed later. We also could structure by domain (e.g. `items`, `users`, `orders`, etc.) to support larger applications (as NestJS modules).
- **SQLite via `better-sqlite3`** — zero setup for the reviewer; with synchronous
  API removes a category of async-error pitfalls. Repository methods are still
  declared `async` to keep the interface backend-agnostic.
- **Auto-increment integer ids** — simple and easier for ad-hoc curl/Postman testing
  than UUIDs.
- **No ORM.** Since the application only uses a single table with a straightforward schema, using an ORM library (like TypeORM or Sequelize) would add unnecessary complexity and extra dependencies. Direct SQL queries are used instead for simplicity.
- **`zod` middleware factory** validates body / query / params uniformly. For
  Express 5, `req.query` is read-only, so the parsed query is passed via
  `res.locals.query`.
- **Update schema is built independently** of the create schema (not via
  `.partial()`) so Zod `.default()` values do not leak into update bodies and
  silently overwrite untouched columns.
- **Sort-column safety** — `sortBy` and `order` are zod enums, so
  interpolating them into the SQL `ORDER BY` clause is safe (no user-controlled
  strings reach the query).
- **Error envelope** is consistent across all 4xx/5xx paths — easy to consume.
- **In-memory DB for tests:** using SQLite database path `:memory:`, the database exists only in RAM for the duration of each test run. This ensures every test starts with a blank database and avoids the need to create or delete temporary files between test runs.
