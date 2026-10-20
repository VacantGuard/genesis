import fs from "node:fs";
import path from "node:path";
import Database from "libsql";
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
  stripeSessionId?: string;
  delivery?: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
  };
};

const globalForDb = globalThis as unknown as {
  kitchenDb?: Database.Database;
  tenancyReady?: boolean;
  envLoaded?: boolean;
  maintenanceDone?: boolean;
  syncTimer?: ReturnType<typeof setTimeout>;
};

let opening = false;

function loadLocalEnv() {
  if (globalForDb.envLoaded) return;
  globalForDb.envLoaded = true;
  const candidates = [
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), "..", ".env.local"),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (!/^TURSO_[A-Z0-9_]+$/.test(key)) continue;
      if (process.env[key]) continue;
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

function dataDir() {
  if (process.env.VERCEL) return "/tmp/kitchen-data";
  return path.join(process.cwd(), "data");
}

function databasePath() {
  return process.env.DATABASE_PATH || path.join(dataDir(), "kitchen.sqlite");
}

export function tursoConfig() {
  loadLocalEnv();
  const token = process.env.TURSO_AUTH_TOKEN?.trim();
  const raw = process.env.TURSO_DATABASE_URL?.trim();
  if (!token || !raw) return null;
  const url = raw.startsWith("https://") ? `libsql://${raw.slice("https://".length)}` : raw;
  if (!url.startsWith("libsql://")) {
    throw new Error("TURSO_DATABASE_URL must start with libsql:// or https://");
  }
  const host = url.slice("libsql://".length).split("/")[0];
  return { url, token, host };
}

function quoteIdent(name: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Unexpected SQL name: ${name}`);
  }
  return `"${name}"`;
}

type TableColumn = {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
};

function columnDefinition(column: TableColumn) {
  const type = column.type || "TEXT";
  if (!column.notnull) return type;
  if (column.dflt_value !== null) return `${type} NOT NULL DEFAULT ${column.dflt_value}`;
  const numeric = /INT|REAL|NUM|FLOA|DOUB|DEC/i.test(type);
  return `${type} NOT NULL DEFAULT ${numeric ? "0" : "''"}`;
}

function copyKitchenTables(from: Database.Database, to: Database.Database) {
  const tables = from
    .prepare(
      `SELECT name, sql FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'libsql_%'
       ORDER BY name`,
    )
    .all() as { name: string; sql: string | null }[];

  to.exec("PRAGMA foreign_keys = OFF");
  const copy = to.transaction(() => {
    for (const table of tables) {
      const exists = to
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
        .get(table.name) as { name: string } | undefined;
      if (!exists && table.sql) to.exec(table.sql);

      const columns = from.prepare(`PRAGMA table_info(${quoteIdent(table.name)})`).all() as TableColumn[];
      const present = new Set(
        (
          to.prepare(`PRAGMA table_info(${quoteIdent(table.name)})`).all() as { name: string }[]
        ).map((column) => column.name),
      );
      for (const column of columns) {
        if (present.has(column.name)) continue;
        to.exec(
          `ALTER TABLE ${quoteIdent(table.name)} ADD COLUMN ${quoteIdent(column.name)} ${columnDefinition(column)}`,
        );
      }
      if (columns.length === 0) continue;
      const rows = from.prepare(`SELECT * FROM ${quoteIdent(table.name)}`).all() as Record<
        string,
        unknown
      >[];
      if (rows.length === 0) continue;
      const names = columns.map((column) => quoteIdent(column.name)).join(", ");
      const placeholders = columns.map(() => "?").join(", ");
      const insert = to.prepare(
        `INSERT OR REPLACE INTO ${quoteIdent(table.name)} (${names}) VALUES (${placeholders})`,
      );
      for (const row of rows) {
        insert.run(...columns.map((column) => row[column.name] ?? null));
      }
    }
  });
  copy();
  to.exec("PRAGMA foreign_keys = ON");
}

function importLocalIfRemoteEmpty(remote: Database.Database) {
  const file = databasePath();
  if (!fs.existsSync(file)) return;
  const remoteRows = remote.prepare("SELECT COUNT(*) AS n FROM business_profile").get() as {
    n: number;
  };
  if (remoteRows.n > 0) return;

  const local = new Database(file, { readonly: true, fileMustExist: true });
  try {
    const localRows = local.prepare("SELECT COUNT(*) AS n FROM business_profile").get() as {
      n: number;
    };
    if (localRows.n === 0) return;
    copyKitchenTables(local, remote);
  } finally {
    local.close();
  }
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

function stripMetadata<T>(value: T): T {
  if (Array.isArray(value)) return value.map((entry) => stripMetadata(entry)) as T;
  if (value && typeof value === "object" && "_metadata" in value) {
    const rest = { ...(value as Record<string, unknown>) };
    delete rest._metadata;
    return rest as T;
  }
  return value;
}

function scheduleSync(db: Database.Database) {
  if (opening || !tursoConfig()) return;
  if (globalForDb.syncTimer) clearTimeout(globalForDb.syncTimer);
  globalForDb.syncTimer = setTimeout(() => {
    try {
      db.sync();
    } catch (error) {
      console.error("Turso sync failed", error);
    }
  }, 200);
}

function openDatabase() {
  const turso = tursoConfig();
  let db: Database.Database;
  if (turso) {
    const file = path.join(dataDir(), "turso-replica.db");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    db = new Database(file, { syncUrl: turso.url, authToken: turso.token } as Database.Options);
    db.sync();
  } else {
    const file = databasePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    db = new Database(file);
  }
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  const exec = db.exec.bind(db);
  db.exec = (source: string) => {
    const result = exec(source);
    scheduleSync(db);
    return result;
  };
  const prepare = db.prepare.bind(db);
  db.prepare = ((source: string) => {
    const statement = prepare(source);
    const get = statement.get.bind(statement);
    const all = statement.all.bind(statement);
    const run = statement.run.bind(statement);
    statement.get = (...params: unknown[]) => stripMetadata(get(...params));
    statement.all = (...params: unknown[]) => stripMetadata(all(...params));
    statement.run = (...params: unknown[]) => {
      const result = run(...params);
      scheduleSync(db);
      return result;
    };
    return statement;
  }) as Database.Database["prepare"];
  return db;
}

export function getDb() {
  if (!globalForDb.kitchenDb) {
    opening = true;
    try {
      const db = openDatabase();
      db.pragma("foreign_keys = ON");
      migrate(db);
      globalForDb.kitchenDb = db;
      if (tursoConfig()) importLocalIfRemoteEmpty(db);
      seed(db);
      globalForDb.tenancyReady = true;
      initTenancy();
    } finally {
      opening = false;
    }
  }
  if (!globalForDb.kitchenDb) throw new Error("Kitchen database failed to open");
  if (opening) return globalForDb.kitchenDb;
  if (!globalForDb.maintenanceDone) {
    reframeLegacyLunchSample(globalForDb.kitchenDb);
    keepSampleAsNorthBowl(globalForDb.kitchenDb);
    globalForDb.maintenanceDone = true;
  }
  return globalForDb.kitchenDb;
}
