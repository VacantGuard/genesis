import { getDb } from "./db";

export type CustomerOrderLine = {
  name: string;
  quantity: number;
  unitPriceCents: number;
};

export type CustomerOrderHistory = {
  id: number;
  orderNumber: string;
  phone: string;
  totalCents: number;
  createdAt: string;
  status: string;
  notes: string;
  items: CustomerOrderLine[];
};

type OrderRow = {
  id: number;
  orderNumber: string;
  phone: string;
  email: string;
  customerId: number | null;
  totalCents: number;
  createdAt: string;
  status: string;
  notes: string;
};

function digits(phone: string) {
  return phone.replace(/\D/g, "");
}

export function ensureCustomerOnOrders(db: ReturnType<typeof getDb> = getDb()) {
  const columns = db.prepare("PRAGMA table_info(orders)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "customer_id")) {
    db.exec("ALTER TABLE orders ADD COLUMN customer_id INTEGER");
  }
}

export function findCustomerId(
  db: ReturnType<typeof getDb>,
  businessId: number,
  phone: string,
  email: string,
) {
  const normalizedEmail = email.trim().toLowerCase();
  const phoneKey = digits(phone);
  const rows = db
    .prepare(`SELECT id, phone, email FROM customers WHERE business_id = ? ORDER BY id`)
    .all(businessId) as { id: number; phone: string; email: string }[];
  if (normalizedEmail.includes("@")) {
    const byEmail = rows.find((row) => row.email.trim().toLowerCase() === normalizedEmail);
    if (byEmail) return byEmail.id;
  }
  if (phoneKey.length >= 7) {
    const byPhone = rows.find((row) => digits(row.phone) === phoneKey);
    if (byPhone) return byPhone.id;
  }
  return null;
}

function orderMatches(order: OrderRow, customerId: number, phone: string, email: string) {
  if (order.customerId === customerId) return true;
  if (order.customerId) return false;
  const phoneKey = digits(phone);
  const normalizedEmail = email.trim().toLowerCase();
  if (phoneKey.length >= 7 && digits(order.phone) === phoneKey) return true;
  if (normalizedEmail.includes("@") && order.email.trim().toLowerCase() === normalizedEmail) return true;
  return false;
}

export function syncOrdersToCustomer(businessId: number, customerId: number, phone: string, email: string) {
  if (!customerId) return;
  const db = getDb();
  ensureCustomerOnOrders(db);
  const orders = db
    .prepare(
      `SELECT id, phone, email, customer_id AS customerId
       FROM orders WHERE business_id = ?`,
    )
    .all(businessId) as Pick<OrderRow, "id" | "phone" | "email" | "customerId">[];
  const claim = db.prepare(
    `UPDATE orders SET customer_id = ? WHERE id = ? AND business_id = ? AND customer_id IS NULL`,
  );
  for (const order of orders) {
    if (orderMatches({ ...order, orderNumber: "", totalCents: 0, createdAt: "", status: "", notes: "" }, customerId, phone, email)) {
      claim.run(customerId, order.id, businessId);
    }
  }
}

function withItems(db: ReturnType<typeof getDb>, orders: OrderRow[]): CustomerOrderHistory[] {
  const items = db.prepare(
    `SELECT item_name AS name, quantity, unit_price_cents AS unitPriceCents
     FROM order_items WHERE order_id = ? ORDER BY id`,
  );
  return orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    phone: order.phone,
    totalCents: order.totalCents,
    createdAt: order.createdAt,
    status: order.status,
    notes: order.notes,
    items: items.all(order.id) as CustomerOrderLine[],
  }));
}

export function ordersForCustomerRecord(
  businessId: number,
  customer: { id: number; phone: string; email: string },
): CustomerOrderHistory[] {
  if (!customer.id) return [];
  syncOrdersToCustomer(businessId, customer.id, customer.phone, customer.email);
  const db = getDb();
  const orders = db
    .prepare(
      `SELECT id, order_number AS orderNumber, phone, email, customer_id AS customerId,
              total_cents AS totalCents, created_at AS createdAt, status, notes
       FROM orders WHERE business_id = ? AND customer_id = ?
       ORDER BY id DESC`,
    )
    .all(businessId, customer.id) as OrderRow[];
  return withItems(db, orders);
}

export function orderForCustomerRecord(
  businessId: number,
  customer: { id: number; phone: string; email: string },
  orderNumber: string,
) {
  return (
    ordersForCustomerRecord(businessId, customer).find((order) => order.orderNumber === orderNumber) ?? null
  );
}
