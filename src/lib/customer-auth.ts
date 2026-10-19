import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getHomepageBusiness } from "./businesses";
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

export type CustomerOrder = {
  orderNumber: string;
  totalCents: number;
  createdAt: string;
  status: string;
  items: string;
};

function ensureAccounts() {
  getDb().exec(`
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
}

function digits(phone: string) {
  return phone.replace(/\D/g, "");
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 32).toString("base64url");
  return `${salt}.${hash}`;
}

function checkPassword(password: string, stored: string) {
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

async function writeCookie(accountId: number) {
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

export function ordersForCustomer(account: CustomerAccount): CustomerOrder[] {
  const phone = digits(account.phone);
  const db = getDb();
  const orders = db
    .prepare(
      `SELECT id, order_number AS orderNumber, phone, total_cents AS totalCents,
              created_at AS createdAt, status
       FROM orders WHERE business_id = ? ORDER BY id DESC`,
    )
    .all(account.businessId) as {
    id: number;
    orderNumber: string;
    phone: string;
    totalCents: number;
    createdAt: string;
    status: string;
  }[];
  const mine = orders.filter((order) => digits(order.phone) === phone).slice(0, 20);
  const items = db.prepare(
    `SELECT item_name AS name, quantity FROM order_items WHERE order_id = ? ORDER BY id`,
  );
  return mine.map((order) => {
    const lines = items.all(order.id) as { name: string; quantity: number }[];
    return {
      orderNumber: order.orderNumber,
      totalCents: order.totalCents,
      createdAt: order.createdAt,
      status: order.status,
      items: lines.map((line) => `${line.quantity} × ${line.name}`).join(", "),
    };
  });
}
