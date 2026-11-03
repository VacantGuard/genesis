import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getHomepageBusiness } from "./businesses";
import { ordersForCustomerRecord, syncOrdersToCustomer } from "./customer-orders";
import { readDeliveryAddress, type DeliveryAddress } from "./delivery";
import { ensureClientNumbers, getCustomer, listCompanies } from "./directory";
import { getDb } from "./db";

const COOKIE = "customer_session";
const BYPASS_COOKIE = "customer_bypass";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const SESSION_SECRET = process.env.SESSION_SECRET || "kitchen-local-session-secret";

type SessionPayload = { accountId: number; exp: number };

export type CustomerAccount = {
  id: number;
  businessId: number;
  customerId: number;
  email: string;
  name: string;
  phone: string;
};

export type CheckoutDetails = {
  name: string;
  phone: string;
  email: string;
  companyName: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
};

export type CustomerOrder = {
  orderNumber: string;
  totalCents: number;
  createdAt: string;
  status: string;
  items: string;
  deliveryDate: string;
};

export function ensureAccounts() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (business_id, email)
    );
  `);
  const columns = db.prepare("PRAGMA table_info(customer_accounts)").all() as { name: string }[];
  const names = new Set(columns.map((column) => column.name));
  if (!names.has("reset_code_hash")) {
    db.exec("ALTER TABLE customer_accounts ADD COLUMN reset_code_hash TEXT NOT NULL DEFAULT ''");
  }
  if (!names.has("reset_expires_at")) {
    db.exec("ALTER TABLE customer_accounts ADD COLUMN reset_expires_at TEXT NOT NULL DEFAULT ''");
  }
}

function digits(phone: string) {
  return phone.replace(/\D/g, "");
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 32).toString("base64url");
  return `${salt}.${hash}`;
}

export function checkPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(".");
  if (!salt || !hash) return false;
  const actual = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "base64url");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function sign(accountId: number) {
  const body = Buffer.from(
    JSON.stringify({ accountId, exp: Date.now() + MAX_AGE_SECONDS * 1000 } satisfies SessionPayload),
  ).toString("base64url");
  const signature = createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function read(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.accountId || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function writeCookie(accountId: number) {
  const jar = await cookies();
  jar.set(COOKIE, sign(accountId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearCustomerSession() {
  const jar = await cookies();
  const cleared = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
  jar.set(COOKIE, "", cleared);
  jar.set(BYPASS_COOKIE, "", cleared);
}

export async function startCustomerBypass() {
  const jar = await cookies();
  jar.set(BYPASS_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

function accountById(id: number): CustomerAccount | null {
  ensureAccounts();
  const row = getDb()
    .prepare(
      `SELECT a.id, a.business_id AS businessId, a.customer_id AS customerId, a.email,
              c.name, c.phone
       FROM customer_accounts a
       JOIN customers c ON c.id = a.customer_id
       WHERE a.id = ?`,
    )
    .get(id) as CustomerAccount | undefined;
  return row ?? null;
}

function bypassAccount(): CustomerAccount {
  const business = getHomepageBusiness();
  return {
    id: 0,
    businessId: business.id,
    customerId: 0,
    email: "",
    name: "Guest",
    phone: "",
  };
}

export function checkoutDetails(
  account: CustomerAccount | null,
  businessId: number,
): CheckoutDetails | null {
  if (!account || account.customerId <= 0 || account.businessId !== businessId) return null;
  const customer = getCustomer(account.businessId, account.customerId);
  return {
    name: customer?.name || account.name || "",
    phone: customer?.phone || account.phone || "",
    email: customer?.email || account.email || "",
    companyName: customer?.companyName ?? "",
    line1: customer?.deliveryLine1 ?? "",
    line2: customer?.deliveryLine2 ?? "",
    city: customer?.deliveryCity ?? "",
    state: customer?.deliveryState ?? "",
    postalCode: customer?.deliveryPostalCode ?? "",
  };
}

function companyIdForName(businessId: number, name: string) {
  if (!name) return null;
  const existing = listCompanies(businessId).find((company) => company.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;
  const inserted = getDb()
    .prepare(
      `INSERT INTO companies (name, contact_name, phone, email, notes, business_id, created_at)
       VALUES (?, '', '', '', '', ?, ?)`,
    )
    .run(name, businessId, new Date().toISOString());
  return Number(inserted.lastInsertRowid);
}

export function updateCustomerProfile(
  account: CustomerAccount,
  input: {
    name: string;
    phone: string;
    email: string;
    companyName: string;
    delivery: DeliveryAddress;
  },
) {
  if (account.customerId <= 0) return { ok: false as const, error: "Sign in to save your profile." };
  const name = input.name.trim().replace(/\s+/g, " ").slice(0, 80);
  const phone = input.phone.trim().replace(/\s+/g, " ").slice(0, 40);
  const email = input.email.trim().toLowerCase().slice(0, 120);
  const companyName = input.companyName.trim().replace(/\s+/g, " ").slice(0, 80);
  const delivery = readDeliveryAddress(input.delivery);
  if (name.length < 2) return { ok: false as const, error: "Enter your name." };
  if (digits(phone).length < 7) return { ok: false as const, error: "Enter a phone number." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false as const, error: "Enter a valid email." };

  const customer = getCustomer(account.businessId, account.customerId);
  if (!customer) return { ok: false as const, error: "That profile could not be found." };

  const db = getDb();
  ensureAccounts();
  const taken = db
    .prepare(`SELECT id FROM customer_accounts WHERE business_id = ? AND email = ? AND id != ?`)
    .get(account.businessId, email, account.id);
  if (taken) return { ok: false as const, error: "That email already has an account." };

  const companyId = companyIdForName(account.businessId, companyName);
  db.prepare(
    `UPDATE customers
     SET name = ?, phone = ?, email = ?, company_id = ?,
         delivery_line1 = ?, delivery_line2 = ?, delivery_city = ?,
         delivery_state = ?, delivery_postal_code = ?
     WHERE id = ? AND business_id = ?`,
  ).run(
    name,
    phone,
    email,
    companyId,
    delivery.line1,
    delivery.line2,
    delivery.city,
    delivery.state,
    delivery.postalCode,
    account.customerId,
    account.businessId,
  );
  db.prepare(`UPDATE customer_accounts SET email = ? WHERE id = ? AND business_id = ?`).run(
    email,
    account.id,
    account.businessId,
  );
  syncOrdersToCustomer(account.businessId, account.customerId, phone, email);
  return { ok: true as const };
}

export async function currentCustomer(): Promise<CustomerAccount | null> {
  const jar = await cookies();
  const session = read(jar.get(COOKIE)?.value);
  if (session) {
    const account = accountById(session.accountId);
    if (account) return account;
  }
  if (jar.get(BYPASS_COOKIE)?.value === "1") return bypassAccount();
  return null;
}

function findCustomer(businessId: number, email: string, phone: string) {
  const db = getDb();
  const byEmail = db
    .prepare(
      `SELECT id, name, phone, email FROM customers
       WHERE business_id = ? AND lower(email) = ? LIMIT 1`,
    )
    .get(businessId, email) as { id: number; name: string; phone: string; email: string } | undefined;
  if (byEmail) return byEmail;
  const phoneKey = digits(phone);
  const rows = db
    .prepare(`SELECT id, name, phone, email FROM customers WHERE business_id = ?`)
    .all(businessId) as { id: number; name: string; phone: string; email: string }[];
  return rows.find((row) => digits(row.phone) === phoneKey) ?? null;
}

export function registerCustomerAccount(input: { name: string; phone: string; email: string; password: string }) {
  ensureAccounts();
  const business = getHomepageBusiness();
  const name = input.name.trim();
  const phone = input.phone.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  if (name.length < 2) return { ok: false as const, error: "Enter your name." };
  if (digits(phone).length < 7) return { ok: false as const, error: "Enter a phone number." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false as const, error: "Enter a valid email." };
  if (password.length < 8) return { ok: false as const, error: "Use a password of at least 8 characters." };

  const db = getDb();
  const taken = db
    .prepare(`SELECT id FROM customer_accounts WHERE business_id = ? AND email = ?`)
    .get(business.id, email);
  if (taken) return { ok: false as const, error: "That email already has an account. Sign in." };

  const accountId = db.transaction(() => {
    const existing = findCustomer(business.id, email, phone);
    let customerId = existing?.id ?? 0;
    if (existing) {
      db.prepare(`UPDATE customers SET name = ?, phone = ?, email = ? WHERE id = ? AND business_id = ?`).run(
        name,
        phone,
        email,
        existing.id,
        business.id,
      );
    } else {
      const inserted = db
        .prepare(
          `INSERT INTO customers (name, phone, email, company_id, notes, business_id, created_at)
           VALUES (?, ?, ?, NULL, '', ?, ?)`,
        )
        .run(name, phone, email, business.id, new Date().toISOString());
      customerId = Number(inserted.lastInsertRowid);
    }
    const account = db
      .prepare(
        `INSERT INTO customer_accounts (business_id, customer_id, email, password_hash, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(business.id, customerId, email, hashPassword(password), new Date().toISOString());
    return Number(account.lastInsertRowid);
  })();

  ensureClientNumbers(business.id);
  const linked = accountById(accountId);
  if (linked) syncOrdersToCustomer(linked.businessId, linked.customerId, linked.phone, linked.email);
  return { ok: true as const, accountId };
}

export async function signUpCustomer(input: { name: string; phone: string; email: string; password: string }) {
  const result = registerCustomerAccount(input);
  if (!result.ok) return result;
  await writeCookie(result.accountId);
  return { ok: true as const };
}

export async function signInCustomer(input: { email: string; password: string }) {
  ensureAccounts();
  const business = getHomepageBusiness();
  const email = input.email.trim().toLowerCase();
  const row = getDb()
    .prepare(
      `SELECT id, password_hash AS passwordHash FROM customer_accounts
       WHERE business_id = ? AND email = ?`,
    )
    .get(business.id, email) as { id: number; passwordHash: string } | undefined;
  if (!row || !checkPassword(input.password, row.passwordHash)) {
    return { ok: false as const, error: "That email and password do not match." };
  }
  await writeCookie(row.id);
  return { ok: true as const };
}

function phoneKey(phone: string) {
  return phone.replace(/\D/g, "");
}

export function ordersForCustomer(account: CustomerAccount): CustomerOrder[] {
  const key = phoneKey(account.phone);
  if (!account.customerId || key.length < 7) return [];
  return ordersForCustomerRecord(account.businessId, {
    id: account.customerId,
    phone: account.phone,
    email: account.email,
  })
    .filter((order) => order.status === "paid" && phoneKey(order.phone) === key)
    .slice(0, 20)
    .map((order) => ({
      orderNumber: order.orderNumber,
      totalCents: order.totalCents,
      createdAt: order.createdAt,
      status: order.status,
      deliveryDate: order.deliveryDate,
      items: order.items
        .map((line) => `${line.quantity} × ${line.name}${line.note ? ` — ${line.note}` : ""}`)
        .join(", "),
    }));
}
