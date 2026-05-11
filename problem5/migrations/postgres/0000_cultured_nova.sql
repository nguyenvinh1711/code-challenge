CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "items" (
   "id" bigserial PRIMARY KEY NOT NULL,
   "name" text NOT NULL,
   "created_at" timestamp with time zone DEFAULT now() NOT NULL,
   "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_name_trgm_idx" ON "items" USING gin (lower("name") gin_trgm_ops);