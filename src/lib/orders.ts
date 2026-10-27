import {
  deliveryLocateUrl,
  formatDeliveryAddress,
  type DeliveryAddress,
} from "./delivery.ts";
import { upsertCustomerDeliveryFromOrder } from "./directory.ts";
import { getDb, OrderError, type NewOrderInput } from "./db.ts";
import type { DashboardStats, KitchenOrder } from "./types.ts";

export type { NewOrderInput };

function ensureOrderDeliveryColumns(db: ReturnType<typeof getDb>) {
  const cols = db.prepare("PRAGMA table_info(orders)").all() as { name: string }[];
  const names = new Set(cols.map((col) => col.name));
  for (const column of [
    "delivery_line1",
    "delivery_line2",
    "delivery_city",
    "delivery_state",
    "delivery_postal_code",
  ]) {
    if (!names.has(column)) {
      db.exec(`ALTER TABLE orders ADD COLUMN ${column} TEXT NOT NULL DEFAULT ''`);
    }
  }
}

function withDelivery(row: {
  deliveryLine1?: string;
  deliveryLine2?: string;
  deliveryCity?: string;
  deliveryState?: string;
  deliveryPostalCode?: string;
}) {
  const delivery: DeliveryAddress = {
    line1: row.deliveryLine1 ?? "",
    line2: row.deliveryLine2 ?? "",
    city: row.deliveryCity ?? "",
    state: row.deliveryState ?? "",
    postalCode: row.deliveryPostalCode ?? "",
  };
  return {
    deliveryLine1: delivery.line1,
    deliveryLine2: delivery.line2,
    deliveryCity: delivery.city,
    deliveryState: delivery.state,
    deliveryPostalCode: delivery.postalCode,
    deliveryAddress: formatDeliveryAddress(delivery),
    deliveryLocateUrl: deliveryLocateUrl(delivery),
  };
}

export function cleanLineNote(value: string | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ").slice(0, 200);
}

export function ensureOrderItemNoteColumn(db: ReturnType<typeof getDb>) {
  const columns = db.prepare("PRAGMA table_info(order_items)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "notes")) {
    db.exec("ALTER TABLE order_items ADD COLUMN notes TEXT NOT NULL DEFAULT ''");
  }
}

function ensureStripeColumn(db: ReturnType<typeof getDb>) {
  const columns = db.prepare("PRAGMA table_info(orders)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "stripe_payment_intent_id")) {
    db.exec("ALTER TABLE orders ADD COLUMN stripe_payment_intent_id TEXT NOT NULL DEFAULT ''");
  }
}

export function priceOrderLines(businessId: number, lines: NewOrderInput["lines"]) {
  const db = getDb();
  if (lines.length === 0) throw new OrderError("Add at least one meal.");
  const priced: { name: string; quantity: number; unitPriceCents: number; note: string }[] = [];
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 25) {
      throw new OrderError("Quantity must be between 1 and 25.");
    }
    const item = db
      .prepare(
        `SELECT i.name, i.price_cents AS priceCents, i.available
         FROM menu_items i
         JOIN menu_categories c ON c.id = i.category_id
         WHERE i.id = ? AND c.business_id = ?`,
      )
      .get(line.menuItemId, businessId) as
      | { name: string; priceCents: number; available: number }
      | undefined;
    if (!item || item.available !== 1) {
      throw new OrderError("Something in the cart is no longer available. Refresh the menu.");
    }
    priced.push({
      name: item.name,
      quantity: line.quantity,
      unitPriceCents: item.priceCents,
      note: cleanLineNote(line.note),
    });
  }
  return {
    priced,
    totalCents: priced.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0),
  };
}

function savedOrder(db: ReturnType<typeof getDb>, orderId: number) {
  ensureOrderDeliveryColumns(db);
  const row = db
    .prepare(
      `SELECT order_number AS orderNumber, customer_name AS customerName, total_cents AS totalCents,
              delivery_line1 AS deliveryLine1, delivery_line2 AS deliveryLine2, delivery_city AS deliveryCity,
              delivery_state AS deliveryState, delivery_postal_code AS deliveryPostalCode
       FROM orders WHERE id = ?`,
    )
    .get(orderId) as
    | {
        orderNumber: string;
        customerName: string;
        totalCents: number;
        deliveryLine1: string;
        deliveryLine2: string;
        deliveryCity: string;
        deliveryState: string;
        deliveryPostalCode: string;
      }
    | undefined;
  if (!row) throw new OrderError("That paid order could not be read back.");
  ensureOrderItemNoteColumn(db);
  const items = db
    .prepare(
      `SELECT item_name AS name, quantity, unit_price_cents AS unitPriceCents, notes AS note
       FROM order_items WHERE order_id = ? ORDER BY id`,
    )
    .all(orderId) as { name: string; quantity: number; unitPriceCents: number; note: string }[];
  const delivery = withDelivery(row);
  return {
    orderNumber: row.orderNumber,
    totalCents: row.totalCents,
    customerName: row.customerName,
    deliveryAddress: delivery.deliveryAddress,
    deliveryLocateUrl: delivery.deliveryLocateUrl,
    items,
  };
}

function nextOrderNumber(db: ReturnType<typeof getDb>) {
  const row = db
    .prepare("SELECT order_number AS orderNumber FROM orders ORDER BY id DESC LIMIT 1")
    .get() as { orderNumber: string } | undefined;
  const current = row ? Number(row.orderNumber.replace(/\D/g, "")) : 1000;
  const next = Number.isFinite(current) && current >= 1000 ? current + 1 : 1001;
  return `WK-${next}`;
}

export function placeOrder(businessId: number, input: NewOrderInput) {
  const db = getDb();
  const run = db.transaction(() => {
    const orderColumns = db.prepare("PRAGMA table_info(orders)").all() as { name: string }[];
    if (!orderColumns.some((column) => column.name === "sms_opt_in")) {
      db.exec("ALTER TABLE orders ADD COLUMN sms_opt_in INTEGER NOT NULL DEFAULT 0");
    }
    ensureStripeColumn(db);
    ensureOrderItemNoteColumn(db);
    const paymentIntentId = input.stripePaymentIntentId?.trim() ?? "";
    if (paymentIntentId) {
      const existing = db
        .prepare(
          "SELECT id FROM orders WHERE business_id = ? AND stripe_payment_intent_id = ? AND stripe_payment_intent_id != ''",
        )
        .get(businessId, paymentIntentId) as { id: number } | undefined;
      if (existing) return savedOrder(db, existing.id);
    }
    const { priced, totalCents } = priceOrderLines(businessId, input.lines);
    ensureOrderDeliveryColumns(db);
    const delivery = input.delivery ?? {
      line1: "",
      line2: "",
      city: "",
      state: "",
      postalCode: "",
    };
    const orderNumber = nextOrderNumber(db);
    const createdAt = new Date().toISOString();
    const inserted = db
      .prepare(
        `INSERT INTO orders
          (order_number, customer_name, phone, email, company_name, notes, card_last4, total_cents, status, created_at, business_id, sms_opt_in,
           delivery_line1, delivery_line2, delivery_city, delivery_state, delivery_postal_code, stripe_payment_intent_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        businessId,
        input.smsOptIn ? 1 : 0,
        delivery.line1,
        delivery.line2,
        delivery.city,
        delivery.state,
        delivery.postalCode,
        paymentIntentId,
      );
    const orderId = Number(inserted.lastInsertRowid);
    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, item_name, quantity, unit_price_cents, notes) VALUES (?, ?, ?, ?, ?)`,
    );
    for (const line of priced) insertItem.run(orderId, line.name, line.quantity, line.unitPriceCents, line.note);
    if (delivery.line1) {
      upsertCustomerDeliveryFromOrder(businessId, {
        customerName: input.customerName,
        phone: input.phone,
        email: input.email,
        companyName: input.companyName,
        delivery,
      });
    }
    return {
      orderNumber,
      totalCents,
      customerName: input.customerName,
      deliveryAddress: formatDeliveryAddress(delivery),
      deliveryLocateUrl: deliveryLocateUrl(delivery),
      items: priced,
    };
  });
  return run();
}

export function listOrders(businessId: number): KitchenOrder[] {
  const db = getDb();
  ensureOrderDeliveryColumns(db);
  ensureOrderItemNoteColumn(db);
  const orders = db
    .prepare(
      `SELECT id, order_number AS orderNumber, customer_name AS customerName, phone, email,
              company_name AS companyName, notes, card_last4 AS cardLast4,
              total_cents AS totalCents, created_at AS createdAt,
              delivery_line1 AS deliveryLine1, delivery_line2 AS deliveryLine2,
              delivery_city AS deliveryCity, delivery_state AS deliveryState,
              delivery_postal_code AS deliveryPostalCode
       FROM orders WHERE business_id = ? ORDER BY id DESC`,
    )
    .all(businessId) as (Omit<KitchenOrder, "items" | "deliveryAddress" | "deliveryLocateUrl"> & {
      deliveryLine1: string;
      deliveryLine2: string;
      deliveryCity: string;
      deliveryState: string;
      deliveryPostalCode: string;
    })[];
  const itemStmt = db.prepare(
    `SELECT item_name AS name, quantity, unit_price_cents AS unitPriceCents, notes AS note
     FROM order_items WHERE order_id = ? ORDER BY id`,
  );
  return orders.map((order) => ({
    ...order,
    ...withDelivery(order),
    items: itemStmt.all(order.id) as KitchenOrder["items"],
  }));
}

export function orderExportRows(businessId: number) {
  const db = getDb();
  ensureOrderDeliveryColumns(db);
  ensureOrderItemNoteColumn(db);
  return db
    .prepare(
      `SELECT o.order_number AS orderNumber, o.customer_name AS customerName,
              o.company_name AS companyName, o.phone, o.email,
              o.delivery_line1 AS deliveryLine1, o.delivery_line2 AS deliveryLine2,
              o.delivery_city AS deliveryCity, o.delivery_state AS deliveryState,
              o.delivery_postal_code AS deliveryPostalCode,
              oi.item_name AS item, oi.quantity, oi.unit_price_cents AS unitPriceCents,
              oi.notes AS itemNote, o.notes, o.created_at AS placedAt
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.business_id = ?
       ORDER BY o.id DESC, oi.id ASC`,
    )
    .all(businessId)
    .map((row) => {
      const order = row as {
        orderNumber: string;
        customerName: string;
        companyName: string;
        phone: string;
        email: string;
        deliveryLine1: string;
        deliveryLine2: string;
        deliveryCity: string;
        deliveryState: string;
        deliveryPostalCode: string;
        item: string;
        quantity: number;
        unitPriceCents: number;
        itemNote: string;
        notes: string;
        placedAt: string;
      };
      const delivery = withDelivery(order);
      return {
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        companyName: order.companyName,
        phone: order.phone,
        email: order.email,
        deliveryAddress: delivery.deliveryAddress,
        deliveryLocateUrl: delivery.deliveryLocateUrl,
        item: order.item,
        quantity: order.quantity,
        unitPriceCents: order.unitPriceCents,
        itemNote: order.itemNote,
        notes: order.notes,
        placedAt: order.placedAt,
      };
    });
}

export function getDashboardStats(businessId: number): DashboardStats {
  const db = getDb();
  const orders = db
    .prepare("SELECT COUNT(*) AS n, COALESCE(SUM(total_cents), 0) AS total FROM orders WHERE business_id = ?")
    .get(businessId) as { n: number; total: number };
  const today = db
    .prepare("SELECT COUNT(*) AS n FROM orders WHERE business_id = ? AND date(created_at) = date('now')")
    .get(businessId) as { n: number };
  const customers = db
    .prepare("SELECT COUNT(*) AS n FROM customers WHERE business_id = ?")
    .get(businessId) as { n: number };
  const companies = db
    .prepare("SELECT COUNT(*) AS n FROM companies WHERE business_id = ?")
    .get(businessId) as { n: number };
  const available = db
    .prepare(
      `SELECT COUNT(*) AS n FROM menu_items i
       JOIN menu_categories c ON c.id = i.category_id
       WHERE c.business_id = ? AND i.available = 1`,
    )
    .get(businessId) as { n: number };
  const campaigns = db
    .prepare("SELECT COUNT(*) AS n FROM campaigns WHERE business_id = ?")
    .get(businessId) as { n: number };
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
