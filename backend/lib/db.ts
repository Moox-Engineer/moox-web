// Backend-owned database. Development: SQLite file (data/moox.db). Production:
// Postgres via DATABASE_URL — its presence selects the dialect, nothing else
// in the codebase knows which one is running. DDL is written to be portable
// across both (TEXT primary keys generated in app code, ISO-8601 timestamps,
// INTEGER 0/1 booleans), so there is one schema for both engines.
//
// What lives here is data the middleware/Odoo does NOT own: carts, and the
// local mapping from middleware order IDs to site customers (guest order
// access). Everything commerce-authoritative stays behind the middleware.

import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Kysely, PostgresDialect, SqliteDialect, sql } from 'kysely'
import Database from 'better-sqlite3'
import { Pool } from 'pg'

export interface CartRow {
  id: string
  created_at: string
  updated_at: string
  status: 'open' | 'converted'
}

export interface CartItemRow {
  cart_id: string
  sku: string
  qty: number
}

export interface OrderRow {
  middleware_order_id: string
  cart_id: string | null
  customer_email: string
  payment_id: string | null
  created_at: string
}

export interface Database {
  carts: CartRow
  cart_items: CartItemRow
  orders: OrderRow
}

function createDb(): Kysely<Database> {
  if (process.env.DATABASE_URL) {
    return new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }),
      }),
    })
  }
  const path = process.env.SQLITE_PATH || join(process.cwd(), 'data', 'moox.db')
  mkdirSync(dirname(path), { recursive: true })
  const sqlite = new Database(path)
  sqlite.pragma('foreign_keys = ON')
  return new Kysely<Database>({ dialect: new SqliteDialect({ database: sqlite }) })
}

// Next dev hot-reload reimports modules; keep one connection per process.
const g = globalThis as unknown as { __mooxDb?: Kysely<Database> }
export const db = g.__mooxDb ?? (g.__mooxDb = createDb())

const DDL = [
  `CREATE TABLE IF NOT EXISTS carts (
     id TEXT PRIMARY KEY,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'open'
   )`,
  `CREATE TABLE IF NOT EXISTS cart_items (
     cart_id TEXT NOT NULL REFERENCES carts(id),
     sku TEXT NOT NULL,
     qty INTEGER NOT NULL,
     PRIMARY KEY (cart_id, sku)
   )`,
  `CREATE TABLE IF NOT EXISTS orders (
     middleware_order_id TEXT PRIMARY KEY,
     cart_id TEXT,
     customer_email TEXT NOT NULL,
     payment_id TEXT,
     created_at TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_orders_email ON orders (customer_email)`,
]

let schemaPromise: Promise<void> | null = null
export function ensureSchema(): Promise<void> {
  schemaPromise ??= (async () => {
    for (const stmt of DDL) await sql.raw(stmt).execute(db)
  })()
  return schemaPromise
}
