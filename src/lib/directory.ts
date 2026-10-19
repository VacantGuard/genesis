import { syncOrdersToCustomer } from "./customer-orders.ts";
import { getDb } from "./db.ts";
import type { Company, Customer } from "./types.ts";

export function listCompanies(businessId: number): Company[] {
  return getDb()
    .prepare(
      `SELECT id, name, contact_name AS contactName, phone, email, notes
       FROM companies
       WHERE business_id = ?
       ORDER BY name COLLATE NOCASE`,
    )
    .all(businessId) as Company[];
}

export function getCompany(businessId: number, id: number): Company | null {
  const row = getDb()
    .prepare(
      `SELECT id, name, contact_name AS contactName, phone, email, notes
       FROM companies WHERE id = ? AND business_id = ?`,
    )
    .get(id, businessId) as Company | undefined;
  return row ?? null;
}

export function saveCompany(input: {
  businessId: number;
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
       WHERE id = ? AND business_id = ?`,
    ).run(input.name, input.contactName, input.phone, input.email, input.notes, input.id, input.businessId);
    return;
  }
  db.prepare(
    `INSERT INTO companies (name, contact_name, phone, email, notes, business_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.name,
    input.contactName,
    input.phone,
    input.email,
    input.notes,
    input.businessId,
    new Date().toISOString(),
  );
}

export function deleteCompany(businessId: number, id: number) {
  getDb().prepare("DELETE FROM companies WHERE id = ? AND business_id = ?").run(id, businessId);
}

const customerSelect = `
  SELECT
    cu.id,
    cu.client_number AS clientNumber,
    cu.name,
    cu.phone,
    cu.email,
    cu.company_id AS companyId,
    COALESCE(co.name, '') AS companyName,
    cu.notes
  FROM customers cu
  LEFT JOIN companies co ON co.id = cu.company_id
`;

function nextClientNumber(db: ReturnType<typeof getDb>, businessId: number) {
  const rows = db
    .prepare(`SELECT client_number AS clientNumber FROM customers WHERE business_id = ?`)
    .all(businessId) as { clientNumber: string | null }[];
  let max = 1000;
  for (const row of rows) {
    const value = Number(String(row.clientNumber ?? "").replace(/\D/g, ""));
    if (Number.isFinite(value) && value > max) max = value;
  }
  return `C-${max + 1}`;
}

export function ensureClientNumbers(businessId: number) {
  const db = getDb();
  const columns = db.prepare("PRAGMA table_info(customers)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "client_number")) {
    db.exec("ALTER TABLE customers ADD COLUMN client_number TEXT");
  }
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS customers_client_number ON customers(business_id, client_number)",
  );
  const missing = db
    .prepare(
      `SELECT id FROM customers
       WHERE business_id = ? AND (client_number IS NULL OR client_number = '')
       ORDER BY id`,
    )
    .all(businessId) as { id: number }[];
  const assign = db.prepare(`UPDATE customers SET client_number = ? WHERE id = ? AND business_id = ?`);
  for (const row of missing) {
    assign.run(nextClientNumber(db, businessId), row.id, businessId);
  }
}

export function listCustomers(businessId: number): Customer[] {
  ensureClientNumbers(businessId);
  return getDb()
    .prepare(
      `${customerSelect}
       WHERE cu.business_id = ?
       ORDER BY cu.name COLLATE NOCASE`,
    )
    .all(businessId) as Customer[];
}

export function getCustomer(businessId: number, id: number): Customer | null {
  ensureClientNumbers(businessId);
  const row = getDb()
    .prepare(`${customerSelect} WHERE cu.id = ? AND cu.business_id = ?`)
    .get(id, businessId) as Customer | undefined;
  return row ?? null;
}

export function saveCustomer(input: {
  businessId: number;
  id?: number;
  name: string;
  phone: string;
  email: string;
  companyId: number | null;
  notes: string;
}) {
  const db = getDb();
  if (input.companyId) {
    const company = getCompany(input.businessId, input.companyId);
    if (!company) return false;
  }
  if (input.id) {
    db.prepare(
      `UPDATE customers
       SET name = ?, phone = ?, email = ?, company_id = ?, notes = ?
       WHERE id = ? AND business_id = ?`,
    ).run(input.name, input.phone, input.email, input.companyId, input.notes, input.id, input.businessId);
    syncOrdersToCustomer(input.businessId, input.id, input.phone, input.email);
    return true;
  }
  const inserted = db
    .prepare(
      `INSERT INTO customers (name, phone, email, company_id, notes, business_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.name,
      input.phone,
      input.email,
      input.companyId,
      input.notes,
      input.businessId,
      new Date().toISOString(),
    );
  const customerId = Number(inserted.lastInsertRowid);
  ensureClientNumbers(input.businessId);
  syncOrdersToCustomer(input.businessId, customerId, input.phone, input.email);
  return true;
}

export function deleteCustomer(businessId: number, id: number) {
  getDb().prepare("DELETE FROM customers WHERE id = ? AND business_id = ?").run(id, businessId);
}
