import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type {
  BusinessProfile,
  Campaign,
  Company,
  Customer,
  DashboardStats,
  KitchenOrder,
  MenuCategory,
  MenuItem,
  PublicCategory,
  SmsDelivery,
} from "@/lib/types";

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
};

type SmsRecipient = {
  name: string;
  phone: string;
  kind: "customer" | "company_contact";
};

const globalForDb = globalThis as unknown as { kitchenDb?: Database.Database };

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

const SAMPLE_NAME = "Hearth Prep";
const SAMPLE_ABOUT = [
  "Hearth Prep is sample copy for a meal prep kitchen. Rewrite it from the staff terminal when this business is real.",
  "Each week the kitchen cooks a short menu of portioned meals: breakfasts, mains, and sides you can heat through the week. Order and pay on this page. Meals are packed for pickup at the kitchen.",
  "Sample prep day is Sunday, with pickup Monday to Wednesday. Change the name, this story, and the weekly menu whenever the cook cycle changes. Delivery routing is not part of this desk.",
].join("\n\n");

function insertSampleMenu(db: Database.Database) {
  const category = db.prepare(
    "INSERT INTO menu_categories (name, sort_order) VALUES (?, ?)",
  );
  const item = db.prepare(
    `INSERT INTO menu_items
      (category_id, name, description, price_cents, available, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  const breakfasts = Number(category.run("Breakfasts", 1).lastInsertRowid);
  const mains = Number(category.run("Mains", 2).lastInsertRowid);
  const sides = Number(category.run("Sides", 3).lastInsertRowid);

  item.run(
    breakfasts,
    "Egg and potato bake",
    "Two portions. Roasted potato, soft egg, and chili oil.",
    1400,
    1,
    1,
  );
  item.run(
    breakfasts,
    "Brown-butter oat jars",
    "Two jars. Toasted oats, pear, and brown sugar.",
    1200,
    1,
    2,
  );
  item.run(
    mains,
    "Roast chicken and farro",
    "Two portions. Chicken thigh, farro, and charred lemon.",
    2800,
    1,
    1,
  );
  item.run(
    mains,
    "Mushroom rye bowl",
    "Two portions. Seared mushrooms, rye berries, and a herb salad.",
    2400,
    1,
    2,
  );
  item.run(
    mains,
    "Chili-oil lentils",
    "Two portions with yogurt and cabbage. Marked sold out in the sample week.",
    2200,
    0,
    3,
  );
  item.run(sides, "Cucumber cups", "Four cups. Rice vinegar, sesame, and dill.", 1000, 1, 1);
  item.run(sides, "Olive oil cake slices", "Four slices with citrus zest.", 1200, 1, 2);
}

function seed(db: Database.Database) {
  const existing = db.prepare("SELECT COUNT(*) AS n FROM business_profile").get() as {
    n: number;
  };
  if (existing.n > 0) return;

  const now = new Date().toISOString();
  const insert = db.transaction(() => {
    db.prepare(
      "INSERT INTO business_profile (id, name, about, updated_at) VALUES (1, ?, ?, ?)",
    ).run(SAMPLE_NAME, SAMPLE_ABOUT, now);

    insertSampleMenu(db);

    const companyId = Number(
      db.prepare(
        `INSERT INTO companies (name, contact_name, phone, email, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        "Sample Studio Co.",
        "Front desk",
        "(555) 014-2100",
        "desk@samplestudio.example",
        "Sample office that orders a weekly meal prep run. Edit or replace it.",
        now,
      ).lastInsertRowid,
    );

    const customer = db.prepare(
      `INSERT INTO customers (name, phone, email, company_id, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    customer.run(
      "Avery Cole",
      "(555) 014-2201",
      "avery.cole@example.com",
      companyId,
      "Sample customer who orders prep for the studio.",
      now,
    );
    customer.run(
      "Morgan Ellis",
      "(555) 014-2208",
      "morgan.ellis@example.com",
      null,
      "Sample customer. No onions.",
      now,
    );
    customer.run(
      "Quinn Park",
      "(555) 014-2214",
      "quinn.park@example.com",
      null,
      "Sample customer record.",
      now,
    );
  });

  insert();
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
  return globalForDb.kitchenDb;
}

function reframeLegacyLunchSample(db: Database.Database) {
  const legacy = db
    .prepare("SELECT id FROM menu_items WHERE name = 'Milk-bread egg sandwich' LIMIT 1")
    .get() as { id: number } | undefined;
  const profile = db
    .prepare("SELECT name, about FROM business_profile WHERE id = 1")
    .get() as { name: string; about: string } | undefined;
  if (!legacy && !profile) return;

  const stillLunchCopy =
    profile?.name === "Weekday Hearth" ||
    profile?.about.includes("sample kitchen copy") ||
    profile?.about.includes("weekday lunch");

  if (!legacy && !stillLunchCopy) return;

  const apply = db.transaction(() => {
    if (legacy) {
      db.prepare("DELETE FROM menu_items").run();
      db.prepare("DELETE FROM menu_categories").run();
      insertSampleMenu(db);
    }
    if (stillLunchCopy) {
      db.prepare(
        "UPDATE business_profile SET name = ?, about = ?, updated_at = ? WHERE id = 1",
      ).run(SAMPLE_NAME, SAMPLE_ABOUT, new Date().toISOString());
    }
    db.prepare(
      `UPDATE companies
       SET notes = ?
       WHERE name = 'Sample Studio Co.' AND notes LIKE '%weekday lunches%'`,
    ).run("Sample office that orders a weekly meal prep run. Edit or replace it.");
    db.prepare(
      `UPDATE customers
       SET notes = ?
       WHERE name = 'Avery Cole' AND notes LIKE '%Sample guest%'`,
    ).run("Sample customer who orders prep for the studio.");
    db.prepare(
      `UPDATE customers SET notes = ? WHERE name = 'Morgan Ellis' AND notes LIKE '%Sample guest%'`,
    ).run("Sample customer. No onions.");
    db.prepare(
      `UPDATE customers SET notes = ? WHERE name = 'Quinn Park' AND notes LIKE '%Sample guest%'`,
    ).run("Sample customer record.");
  });
  apply();
}

export function getProfile(): BusinessProfile {
  const row = getDb()
    .prepare("SELECT name, about FROM business_profile WHERE id = 1")
    .get() as BusinessProfile | undefined;
  if (!row) throw new Error("Business profile is missing.");
  return row;
}

export function updateProfile(name: string, about: string) {
  getDb()
    .prepare(
      "UPDATE business_profile SET name = ?, about = ?, updated_at = ? WHERE id = 1",
    )
    .run(name, about, new Date().toISOString());
}

export function listCategories(): MenuCategory[] {
  const rows = getDb()
    .prepare(
      "SELECT id, name, sort_order AS sortOrder FROM menu_categories ORDER BY sort_order, id",
    )
    .all() as MenuCategory[];
  return rows;
}

export function listMenuItems(): MenuItem[] {
  return getDb()
    .prepare(
      `SELECT
         i.id,
         i.category_id AS categoryId,
         c.name AS categoryName,
         i.name,
         i.description,
         i.price_cents AS priceCents,
         i.available AS available,
         i.sort_order AS sortOrder
       FROM menu_items i
       JOIN menu_categories c ON c.id = i.category_id
       ORDER BY c.sort_order, i.sort_order, i.id`,
    )
    .all()
    .map((row) => {
      const item = row as Omit<MenuItem, "available"> & { available: number };
      return { ...item, available: item.available === 1 };
    });
}

export function getPublicMenu(): PublicCategory[] {
  const categories = listCategories();
  const items = listMenuItems();
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    items: items
      .filter((item) => item.categoryId === category.id)
      .map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        priceCents: item.priceCents,
        available: item.available,
      })),
  }));
}

export function createCategory(name: string) {
  const db = getDb();
  const row = db.prepare("SELECT COALESCE(MAX(sort_order), 0) AS n FROM menu_categories").get() as {
    n: number;
  };
  db.prepare("INSERT INTO menu_categories (name, sort_order) VALUES (?, ?)").run(name, row.n + 1);
}

export function renameCategory(id: number, name: string) {
  getDb().prepare("UPDATE menu_categories SET name = ? WHERE id = ?").run(name, id);
}

export function deleteCategory(id: number) {
  getDb().prepare("DELETE FROM menu_categories WHERE id = ?").run(id);
}

export function createMenuItem(input: {
  categoryId: number;
  name: string;
  description: string;
  priceCents: number;
  available: boolean;
}) {
  const db = getDb();
  const row = db
    .prepare("SELECT COALESCE(MAX(sort_order), 0) AS n FROM menu_items WHERE category_id = ?")
    .get(input.categoryId) as { n: number };
  db.prepare(
    `INSERT INTO menu_items (category_id, name, description, price_cents, available, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    input.categoryId,
    input.name,
    input.description,
    input.priceCents,
    input.available ? 1 : 0,
    row.n + 1,
  );
}

export function updateMenuItem(input: {
  id: number;
  categoryId: number;
  name: string;
  description: string;
  priceCents: number;
  available: boolean;
}) {
  getDb()
    .prepare(
      `UPDATE menu_items
       SET category_id = ?, name = ?, description = ?, price_cents = ?, available = ?
       WHERE id = ?`,
    )
    .run(
      input.categoryId,
      input.name,
      input.description,
      input.priceCents,
      input.available ? 1 : 0,
      input.id,
    );
}

export function setMenuItemAvailability(id: number, available: boolean) {
  getDb().prepare("UPDATE menu_items SET available = ? WHERE id = ?").run(available ? 1 : 0, id);
}

export function deleteMenuItem(id: number) {
  getDb().prepare("DELETE FROM menu_items WHERE id = ?").run(id);
}

function mapCompany(row: {
  id: number;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  notes: string;
}): Company {
  return row;
}

export function listCompanies(): Company[] {
  return (
    getDb()
      .prepare(
        `SELECT id, name, contact_name AS contactName, phone, email, notes
         FROM companies
         ORDER BY name COLLATE NOCASE`,
      )
      .all() as Company[]
  ).map(mapCompany);
}

export function getCompany(id: number): Company | null {
  const row = getDb()
    .prepare(
      `SELECT id, name, contact_name AS contactName, phone, email, notes
       FROM companies WHERE id = ?`,
    )
    .get(id) as Company | undefined;
  return row ?? null;
}

export function saveCompany(input: {
  id?: number;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  notes: string;
}) {
  const db = getDb();
  if (input.id) {
    db.prepare(
      `UPDATE companies
       SET name = ?, contact_name = ?, phone = ?, email = ?, notes = ?
       WHERE id = ?`,
    ).run(input.name, input.contactName, input.phone, input.email, input.notes, input.id);
    return;
  }
  db.prepare(
    `INSERT INTO companies (name, contact_name, phone, email, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(input.name, input.contactName, input.phone, input.email, input.notes, new Date().toISOString());
}

export function deleteCompany(id: number) {
  getDb().prepare("DELETE FROM companies WHERE id = ?").run(id);
}

export function listCustomers(): Customer[] {
  return getDb()
    .prepare(
      `SELECT
         cu.id,
         cu.name,
         cu.phone,
         cu.email,
         cu.company_id AS companyId,
         COALESCE(co.name, '') AS companyName,
         cu.notes
       FROM customers cu
       LEFT JOIN companies co ON co.id = cu.company_id
       ORDER BY cu.name COLLATE NOCASE`,
    )
    .all() as Customer[];
}

export function getCustomer(id: number): Customer | null {
  const row = getDb()
    .prepare(
      `SELECT
         cu.id,
         cu.name,
         cu.phone,
         cu.email,
         cu.company_id AS companyId,
         COALESCE(co.name, '') AS companyName,
         cu.notes
       FROM customers cu
       LEFT JOIN companies co ON co.id = cu.company_id
       WHERE cu.id = ?`,
    )
    .get(id) as Customer | undefined;
  return row ?? null;
}

export function saveCustomer(input: {
  id?: number;
  name: string;
  phone: string;
  email: string;
  companyId: number | null;
  notes: string;
}) {
  const db = getDb();
  if (input.id) {
    db.prepare(
      `UPDATE customers
       SET name = ?, phone = ?, email = ?, company_id = ?, notes = ?
       WHERE id = ?`,
    ).run(input.name, input.phone, input.email, input.companyId, input.notes, input.id);
    return;
  }
  db.prepare(
    `INSERT INTO customers (name, phone, email, company_id, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    input.name,
    input.phone,
    input.email,
    input.companyId,
    input.notes,
    new Date().toISOString(),
  );
}

export function deleteCustomer(id: number) {
  getDb().prepare("DELETE FROM customers WHERE id = ?").run(id);
}

function nextOrderNumber(db: Database.Database) {
  const row = db
    .prepare("SELECT order_number AS orderNumber FROM orders ORDER BY id DESC LIMIT 1")
    .get() as { orderNumber: string } | undefined;
  const current = row ? Number(row.orderNumber.replace(/\D/g, "")) : 1000;
  const next = Number.isFinite(current) && current >= 1000 ? current + 1 : 1001;
  return `WK-${next}`;
}

export function placeOrder(input: NewOrderInput) {
  const db = getDb();
  const run = db.transaction(() => {
    if (input.lines.length === 0) throw new OrderError("Add at least one meal.");

    const priced: { name: string; quantity: number; unitPriceCents: number }[] = [];
    for (const line of input.lines) {
      if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 25) {
        throw new OrderError("Quantity must be between 1 and 25.");
      }
      const item = db
        .prepare(
          `SELECT name, price_cents AS priceCents, available
           FROM menu_items WHERE id = ?`,
        )
        .get(line.menuItemId) as
        | { name: string; priceCents: number; available: number }
        | undefined;
      if (!item || item.available !== 1) {
        throw new OrderError("Something in the cart is no longer available. Refresh the menu.");
      }
      priced.push({
        name: item.name,
        quantity: line.quantity,
        unitPriceCents: item.priceCents,
      });
    }

    const totalCents = priced.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
    const orderNumber = nextOrderNumber(db);
    const createdAt = new Date().toISOString();
    const inserted = db
      .prepare(
        `INSERT INTO orders
          (order_number, customer_name, phone, email, company_name, notes, card_last4, total_cents, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?)`,
      )
      .run(
        orderNumber,
        input.customerName,
        input.phone,
        input.email,
        input.companyName,
        input.notes,
        input.cardLast4,
        totalCents,
        createdAt,
      );
    const orderId = Number(inserted.lastInsertRowid);
    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, item_name, quantity, unit_price_cents)
       VALUES (?, ?, ?, ?)`,
    );
    for (const line of priced) {
      insertItem.run(orderId, line.name, line.quantity, line.unitPriceCents);
    }
    return {
      orderNumber,
      totalCents,
      customerName: input.customerName,
      items: priced,
    };
  });
  return run();
}

export function listOrders(): KitchenOrder[] {
  const db = getDb();
  const orders = db
    .prepare(
      `SELECT
         id,
         order_number AS orderNumber,
         customer_name AS customerName,
         phone,
         email,
         company_name AS companyName,
         notes,
         card_last4 AS cardLast4,
         total_cents AS totalCents,
         created_at AS createdAt
       FROM orders
       ORDER BY id DESC`,
    )
    .all() as Omit<KitchenOrder, "items">[];
  const itemStmt = db.prepare(
    `SELECT item_name AS name, quantity, unit_price_cents AS unitPriceCents
     FROM order_items WHERE order_id = ? ORDER BY id`,
  );
  return orders.map((order) => ({
    ...order,
    items: itemStmt.all(order.id) as KitchenOrder["items"],
  }));
}

export function orderExportRows() {
  return getDb()
    .prepare(
      `SELECT
         o.order_number AS orderNumber,
         o.customer_name AS customerName,
         o.company_name AS companyName,
         o.phone,
         o.email,
         oi.item_name AS item,
         oi.quantity,
         oi.unit_price_cents AS unitPriceCents,
         o.notes,
         o.created_at AS placedAt
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       ORDER BY o.id DESC, oi.id ASC`,
    )
    .all() as {
    orderNumber: string;
    customerName: string;
    companyName: string;
    phone: string;
    email: string;
    item: string;
    quantity: number;
    unitPriceCents: number;
    notes: string;
    placedAt: string;
  }[];
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export function sendCampaign(input: {
  message: string;
  linkUrl: string;
  includeCustomers: boolean;
  includeCompanyContacts: boolean;
}) {
  const db = getDb();
  const recipients: SmsRecipient[] = [];
  const seen = new Set<string>();

  const push = (recipient: SmsRecipient) => {
    const key = normalizePhone(recipient.phone);
    if (key.length < 7 || seen.has(key)) return;
    seen.add(key);
    recipients.push(recipient);
  };

  if (input.includeCustomers) {
    for (const customer of listCustomers()) {
      push({ name: customer.name, phone: customer.phone, kind: "customer" });
    }
  }
  if (input.includeCompanyContacts) {
    for (const company of listCompanies()) {
      const name = company.contactName || company.name;
      push({ name, phone: company.phone, kind: "company_contact" });
    }
  }

  if (recipients.length === 0) {
    throw new OrderError("That audience has no phone numbers to log.");
  }

  const body = input.message.includes(input.linkUrl)
    ? input.message
    : `${input.message.trim()}\n${input.linkUrl}`;
  const createdAt = new Date().toISOString();

  const run = db.transaction(() => {
    const campaign = db
      .prepare(
        `INSERT INTO campaigns
          (message, link_url, include_customers, include_company_contacts, recipient_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        body,
        input.linkUrl,
        input.includeCustomers ? 1 : 0,
        input.includeCompanyContacts ? 1 : 0,
        recipients.length,
        createdAt,
      );
    const campaignId = Number(campaign.lastInsertRowid);
    const log = db.prepare(
      `INSERT INTO sms_log
        (campaign_id, recipient_name, recipient_kind, phone, body, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'logged', ?)`,
    );
    for (const recipient of recipients) {
      log.run(campaignId, recipient.name, recipient.kind, recipient.phone, body, createdAt);
      console.info(
        `[local-sms] status=logged to=${recipient.phone} name=${recipient.name} campaign=${campaignId}`,
      );
    }
    return { campaignId, recipientCount: recipients.length, linkUrl: input.linkUrl };
  });

  return run();
}

export function listCampaigns(): Campaign[] {
  const db = getDb();
  const campaigns = db
    .prepare(
      `SELECT
         id,
         message,
         link_url AS linkUrl,
         include_customers AS includeCustomers,
         include_company_contacts AS includeCompanyContacts,
         recipient_count AS recipientCount,
         created_at AS createdAt
       FROM campaigns
       ORDER BY id DESC`,
    )
    .all() as (Omit<Campaign, "includeCustomers" | "includeCompanyContacts" | "deliveries"> & {
    includeCustomers: number;
    includeCompanyContacts: number;
  })[];
  const deliveries = db.prepare(
    `SELECT
       id,
       recipient_name AS recipientName,
       recipient_kind AS recipientKind,
       phone,
       body,
       status,
       created_at AS createdAt
     FROM sms_log
     WHERE campaign_id = ?
     ORDER BY id`,
  );
  return campaigns.map((campaign) => ({
    id: campaign.id,
    message: campaign.message,
    linkUrl: campaign.linkUrl,
    includeCustomers: campaign.includeCustomers === 1,
    includeCompanyContacts: campaign.includeCompanyContacts === 1,
    recipientCount: campaign.recipientCount,
    createdAt: campaign.createdAt,
    deliveries: deliveries.all(campaign.id) as SmsDelivery[],
  }));
}

export function getDashboardStats(): DashboardStats {
  const db = getDb();
  const orders = db
    .prepare("SELECT COUNT(*) AS n, COALESCE(SUM(total_cents), 0) AS total FROM orders")
    .get() as { n: number; total: number };
  const today = db
    .prepare("SELECT COUNT(*) AS n FROM orders WHERE date(created_at) = date('now')")
    .get() as { n: number };
  const customers = db.prepare("SELECT COUNT(*) AS n FROM customers").get() as { n: number };
  const companies = db.prepare("SELECT COUNT(*) AS n FROM companies").get() as { n: number };
  const available = db
    .prepare("SELECT COUNT(*) AS n FROM menu_items WHERE available = 1")
    .get() as { n: number };
  const campaigns = db.prepare("SELECT COUNT(*) AS n FROM campaigns").get() as { n: number };
  return {
    orderCount: orders.n,
    todayOrderCount: today.n,
    salesCents: orders.total,
    customerCount: customers.n,
    companyCount: companies.n,
    availableItemCount: available.n,
    campaignCount: campaigns.n,
  };
}
