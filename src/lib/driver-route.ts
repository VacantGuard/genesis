import { formatDeliveryAddress, hasDeliveryAddress, readDeliveryAddress } from "./delivery.ts";
import { formatDeliveryDate } from "./delivery-dates.ts";
import { getDb } from "./db.ts";
import { sendTextMessage, textCredentials, toE164 } from "./messaging.ts";
import { ensureOrderDeliveryColumns } from "./orders.ts";

export type Driver = {
  id: number;
  name: string;
  phone: string;
};

export type RouteStop = {
  names: string;
  address: string;
  orderNumbers: string[];
};

export type DeliveryRoute = {
  date: string;
  label: string;
  start: string;
  stops: RouteStop[];
  missing: { orderNumber: string; customerName: string }[];
  directionsUrl: string;
  mapCoversAllStops: boolean;
  message: string;
};

const MAP_STOPS = 10;

function ensureDriverSchema() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS drivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  const names = new Set(
    (db.prepare("PRAGMA table_info(businesses)").all() as { name: string }[]).map((column) => column.name),
  );
  if (!names.has("route_start_address")) {
    db.exec("ALTER TABLE businesses ADD COLUMN route_start_address TEXT NOT NULL DEFAULT ''");
  }
}

export function listDrivers(businessId: number): Driver[] {
  ensureDriverSchema();
  return getDb()
    .prepare(
      `SELECT id, name, phone FROM drivers WHERE business_id = ? ORDER BY id`,
    )
    .all(businessId) as Driver[];
}

export function addDriver(businessId: number, input: { name: string; phone: string }) {
  ensureDriverSchema();
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) throw new Error("Driver names need 2 to 80 characters.");
  const phone = toE164(input.phone);
  if (!phone) throw new Error("Use the driver's mobile number, including the area code.");
  const existing = getDb()
    .prepare("SELECT id FROM drivers WHERE business_id = ? AND phone = ?")
    .get(businessId, phone) as { id: number } | undefined;
  if (existing) {
    getDb().prepare("UPDATE drivers SET name = ? WHERE id = ? AND business_id = ?").run(name, existing.id, businessId);
    return existing.id;
  }
  const inserted = getDb()
    .prepare("INSERT INTO drivers (business_id, name, phone, created_at) VALUES (?, ?, ?, ?)")
    .run(businessId, name, phone, new Date().toISOString());
  return Number(inserted.lastInsertRowid);
}

export function removeDriver(businessId: number, id: number) {
  ensureDriverSchema();
  const result = getDb().prepare("DELETE FROM drivers WHERE id = ? AND business_id = ?").run(id, businessId);
  return result.changes > 0;
}

export function routeStartAddress(businessId: number) {
  ensureDriverSchema();
  const row = getDb()
    .prepare("SELECT route_start_address AS start FROM businesses WHERE id = ?")
    .get(businessId) as { start: string } | undefined;
  return row?.start ?? "";
}

export function saveRouteStart(businessId: number, start: string) {
  ensureDriverSchema();
  const cleaned = start.trim().replace(/\s+/g, " ").slice(0, 180);
  getDb()
    .prepare("UPDATE businesses SET route_start_address = ?, updated_at = ? WHERE id = ?")
    .run(cleaned, new Date().toISOString(), businessId);
  return cleaned;
}

export function directionsUrl(origin: string, addresses: string[]) {
  if (addresses.length === 0) return "";
  const limited = addresses.slice(0, MAP_STOPS);
  const destination = limited[limited.length - 1];
  const waypoints = limited.slice(0, -1);
  const params = new URLSearchParams({ api: "1", travelmode: "driving", destination });
  if (origin) params.set("origin", origin);
  if (waypoints.length > 0) params.set("waypoints", waypoints.join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function chicagoToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "numeric",
  }).format(new Date());
}

export function deliveryRoute(businessId: number, date?: string): DeliveryRoute {
  ensureDriverSchema();
  const db = getDb();
  ensureOrderDeliveryColumns(db);
  const requested = (date ?? "").trim();
  let chosen = requested;
  if (!chosen) {
    const upcoming = db
      .prepare(
        `SELECT delivery_date AS date FROM orders
         WHERE business_id = ? AND delivery_date >= ? AND status IN ('paid', 'zelle')
         ORDER BY delivery_date LIMIT 1`,
      )
      .get(businessId, chicagoToday()) as { date: string } | undefined;
    chosen = upcoming?.date ?? "";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(chosen)) {
    throw new Error("Name a delivery date, such as 2026-11-05. No upcoming deliveries have an address yet.");
  }
  const rows = db
    .prepare(
      `SELECT order_number AS orderNumber, customer_name AS customerName,
              delivery_line1 AS line1, delivery_line2 AS line2, delivery_city AS city,
              delivery_state AS state, delivery_postal_code AS postalCode
       FROM orders
       WHERE business_id = ? AND delivery_date = ? AND status IN ('paid', 'zelle')
       ORDER BY id`,
    )
    .all(businessId, chosen) as {
    orderNumber: string;
    customerName: string;
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
  }[];
  const missing: DeliveryRoute["missing"] = [];
  const grouped = new Map<string, RouteStop & { postal: string }>();
  for (const row of rows) {
    const address = readDeliveryAddress(row);
    if (!hasDeliveryAddress(address)) {
      missing.push({ orderNumber: row.orderNumber, customerName: row.customerName });
      continue;
    }
    const formatted = formatDeliveryAddress(address);
    const current = grouped.get(formatted);
    if (current) {
      current.names = `${current.names} & ${row.customerName}`;
      current.orderNumbers.push(row.orderNumber);
      continue;
    }
    grouped.set(formatted, {
      names: row.customerName,
      address: formatted,
      orderNumbers: [row.orderNumber],
      postal: address.postalCode,
    });
  }
  const stops = [...grouped.values()]
    .sort((a, b) => a.postal.localeCompare(b.postal) || a.address.localeCompare(b.address))
    .map(({ names, address, orderNumbers }) => ({ names, address, orderNumbers }));
  const start = routeStartAddress(businessId);
  const url = directionsUrl(start, stops.map((stop) => stop.address));
  const label = formatDeliveryDate(chosen) || chosen;
  const lines = [
    `TigEats delivery ${label}`,
    start ? `Start: ${start}` : "",
    ...stops.map((stop, index) => `${index + 1}. ${stop.names} — ${stop.address}`),
    missing.length ? `No address: ${missing.map((order) => `${order.orderNumber} ${order.customerName}`).join("; ")}` : "",
    stops.length > MAP_STOPS ? `The map link includes the first ${MAP_STOPS} stops.` : "",
    url ? `Route: ${url}` : "",
  ].filter(Boolean);
  return {
    date: chosen,
    label,
    start,
    stops,
    missing,
    directionsUrl: url,
    mapCoversAllStops: stops.length <= MAP_STOPS,
    message: lines.join("\n"),
  };
}

export async function sendDriverRoute(input: { businessId: number; date?: string; phones?: string[] }) {
  const route = deliveryRoute(input.businessId, input.date);
  if (route.stops.length === 0) {
    throw new Error(
      route.missing.length
        ? "Those orders have no delivery address yet."
        : "No paid or Zelle orders are on that delivery date.",
    );
  }
  const requested = (input.phones ?? []).map((phone) => phone.trim()).filter(Boolean);
  const targets = requested.length
    ? requested.map((phone) => ({ name: "Driver", phone }))
    : listDrivers(input.businessId);
  if (targets.length === 0) {
    return { route, sent: false as const, detail: "No driver phones are saved. Add them on Orders, or include phones.", results: [] };
  }
  const credentials = textCredentials(input.businessId);
  if (!credentials) {
    return {
      route,
      sent: false as const,
      detail: "The text platform is not connected, so the route was not texted.",
      results: [],
    };
  }
  const sms =
    route.message.length <= 1500
      ? route.message
      : `TigEats delivery ${route.label}\n${route.stops.length} stops\nRoute: ${route.directionsUrl}`.slice(0, 1500);
  const results = [];
  for (const driver of targets) {
    const result = await sendTextMessage(credentials, driver.phone, sms);
    results.push({ name: driver.name, phone: toE164(driver.phone) ?? driver.phone, ok: result.ok, detail: result.detail });
  }
  const sentCount = results.filter((result) => result.ok).length;
  return {
    route,
    sent: sentCount > 0,
    detail: sentCount === results.length ? "" : `${sentCount} of ${results.length} driver texts were sent.`,
    results,
  };
}
