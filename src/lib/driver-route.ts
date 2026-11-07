import { formatDeliveryAddress, hasDeliveryAddress, readDeliveryAddress } from "./delivery.ts";
import { formatDeliveryDate } from "./delivery-dates.ts";
import { getDb } from "./db.ts";
import { sendTextMessage, textCredentials, toE164 } from "./messaging.ts";
import { ensureOrderDeliveryColumns } from "./orders.ts";
import { orderByDistance, type Point } from "./route-order.ts";

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
  orderedBy: "drive" | "distance" | "zip";
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
  db.exec(`
    CREATE TABLE IF NOT EXISTS geocodes (
      address TEXT PRIMARY KEY,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      found INTEGER NOT NULL
    );
  `);
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

async function locateAddress(address: string): Promise<Point | null> {
  const db = getDb();
  const cached = db
    .prepare("SELECT lat, lng, found FROM geocodes WHERE address = ?")
    .get(address) as { lat: number; lng: number; found: number } | undefined;
  if (cached) return cached.found ? { lat: cached.lat, lng: cached.lng } : null;
  const url = new URL("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress");
  url.searchParams.set("address", address);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "tigeats-route" },
      signal: AbortSignal.timeout(8000),
    });
    const body = (await response.json()) as {
      result?: { addressMatches?: { coordinates?: { x?: number; y?: number } }[] };
    };
    const match = body.result?.addressMatches?.[0]?.coordinates;
    const lat = Number(match?.y);
    const lng = Number(match?.x);
    const found = Number.isFinite(lat) && Number.isFinite(lng);
    db.prepare("INSERT OR REPLACE INTO geocodes (address, lat, lng, found) VALUES (?, ?, ?, ?)").run(
      address,
      found ? lat : 0,
      found ? lng : 0,
      found ? 1 : 0,
    );
    return found ? { lat, lng } : null;
  } catch {
    return null;
  }
}

async function drivingOrder(start: Point | null, points: Point[]) {
  const coords = start ? [start, ...points] : points;
  if (coords.length < 2) return points.map((_, index) => index);
  const path = coords.map((point) => `${point.lng},${point.lat}`).join(";");
  const params = new URLSearchParams({ overview: "false", roundtrip: "false" });
  if (start) params.set("source", "first");
  else {
    params.set("source", "any");
    params.set("destination", "any");
  }
  try {
    const response = await fetch(`https://router.project-osrm.org/trip/v1/driving/${path}?${params}`, {
      headers: { "user-agent": "tigeats-route" },
      signal: AbortSignal.timeout(8000),
    });
    const body = (await response.json()) as { code?: string; waypoints?: { waypoint_index?: number }[] };
    if (body.code !== "Ok" || !body.waypoints || body.waypoints.length !== coords.length) return null;
    const ranked = body.waypoints.map((waypoint, inputIndex) => ({
      inputIndex,
      trip: waypoint.waypoint_index ?? inputIndex,
    }));
    ranked.sort((a, b) => a.trip - b.trip);
    return ranked.map((item) => item.inputIndex).flatMap((inputIndex) => {
      if (start && inputIndex === 0) return [];
      return [start ? inputIndex - 1 : inputIndex];
    });
  } catch {
    return null;
  }
}

export async function deliveryRoute(businessId: number, date?: string): Promise<DeliveryRoute> {
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
  const groupedStops = [...grouped.values()];
  const start = routeStartAddress(businessId);
  const startPoint = start ? await locateAddress(start) : null;
  const located = [];
  for (const stop of groupedStops) {
    located.push({ ...stop, point: await locateAddress(stop.address) });
  }
  const placed = located.filter((stop) => stop.point);
  const unplaced = located.filter((stop) => !stop.point);
  let orderedBy: DeliveryRoute["orderedBy"] = "zip";
  let orderedPlaced = placed;
  if (placed.length > 1 && placed.every((stop) => stop.point)) {
    const points = placed.map((stop) => stop.point as Point);
    const drive = await drivingOrder(startPoint, points);
    if (drive && drive.length === placed.length) {
      orderedPlaced = drive.map((index) => placed[index]);
      orderedBy = "drive";
    } else {
      orderedPlaced = orderByDistance(startPoint, points).map((index) => placed[index]);
      orderedBy = "distance";
    }
  } else if (placed.length === 1) {
    orderedBy = startPoint ? "drive" : "distance";
  } else {
    orderedPlaced = [...placed].sort((a, b) => a.postal.localeCompare(b.postal) || a.address.localeCompare(b.address));
  }
  const unplacedSorted = [...unplaced].sort(
    (a, b) => a.postal.localeCompare(b.postal) || a.address.localeCompare(b.address),
  );
  const stops = [...orderedPlaced, ...unplacedSorted].map(({ names, address, orderNumbers }) => ({
    names,
    address,
    orderNumbers,
  }));
  const url = directionsUrl(start, stops.map((stop) => stop.address));
  const label = formatDeliveryDate(chosen) || chosen;
  const orderNote =
    orderedBy === "drive"
      ? "Drive the stops in this order."
      : orderedBy === "distance"
        ? "Stops are ordered by distance from the start."
        : "Stops are in ZIP order because the map could not place them.";
  const lines = [
    `TigEats delivery ${label}`,
    start ? `Start: ${start}` : "",
    orderNote,
    ...stops.map((stop, index) => `${index + 1}. ${stop.names} — ${stop.address}`),
    missing.length ? `No address: ${missing.map((order) => `${order.orderNumber} ${order.customerName}`).join("; ")}` : "",
    unplaced.length ? "Stops that could not be placed on the map are listed last." : "",
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
    orderedBy,
    message: lines.join("\n"),
  };
}

export async function sendDriverRoute(input: { businessId: number; date?: string; phones?: string[] }) {
  const route = await deliveryRoute(input.businessId, input.date);
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
