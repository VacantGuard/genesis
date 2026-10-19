import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { initTenancy, keepSampleAsNorthBowl } from "./businesses.ts";
import { reframeLegacyLunchSample, seed } from "./seed.ts";
export class OrderError extends Error {}

export type OrderLineInput = {
  menuItemId: number;
  quantity: number;
};

export type NewOrderInput = {
  customerName: string;
  phone: string;
  email: string;
  companyName: string;
  notes: string;
  cardLast4: string;
  lines: OrderLineInput[];
  smsOptIn?: boolean;
};

const globalForDb = globalThis as unknown as {
  kitchenDb?: Database.Database;
  tenancyReady?: boolean;
};

function databasePath() {
  return process.env.DATABASE_PATH || path.join(process.cwd(), "data", "kitchen.sqlite");
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS business_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL,
      about TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS menu_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price_cents INTEGER NOT NULL,
      available INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      company_name TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      card_last4 TEXT NOT NULL,
      total_cents INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'paid',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      item_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price_cents INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT NOT NULL,
      link_url TEXT NOT NULL,
      include_customers INTEGER NOT NULL,
      include_company_contacts INTEGER NOT NULL,
      recipient_count INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sms_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      recipient_name TEXT NOT NULL,
      recipient_kind TEXT NOT NULL,
      phone TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'logged',
      created_at TEXT NOT NULL
    );
  `);
}

export function getDb() {
  if (!globalForDb.kitchenDb) {
    const file = databasePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const db = new Database(file);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000");
    migrate(db);
    seed(db);
    globalForDb.kitchenDb = db;
  }
  reframeLegacyLunchSample(globalForDb.kitchenDb);
  if (!globalForDb.tenancyReady) {
    globalForDb.tenancyReady = true;
    initTenancy();
  }
  keepSampleAsNorthBowl(globalForDb.kitchenDb);
  return globalForDb.kitchenDb;
}

