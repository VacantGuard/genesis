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

export function listCustomers(businessId: number): Customer[] {
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
       WHERE cu.business_id = ?
       ORDER BY cu.name COLLATE NOCASE`,
    )
    .all(businessId) as Customer[];
}

export function getCustomer(businessId: number, id: number): Customer | null {
  const row = getDb()
    .prepare(
      `SELECT
         cu.id, cu.name, cu.phone, cu.email,
         cu.company_id AS companyId,
         COALESCE(co.name, '') AS companyName,
         cu.notes
       FROM customers cu
       LEFT JOIN companies co ON co.id = cu.company_id
       WHERE cu.id = ? AND cu.business_id = ?`,
    )
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
    return true;
  }
  db.prepare(
    `INSERT INTO customers (name, phone, email, company_id, notes, business_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.name,
    input.phone,
    input.email,
    input.companyId,
    input.notes,
    input.businessId,
    new Date().toISOString(),
  );
  return true;
}

export function deleteCustomer(businessId: number, id: number) {
  getDb().prepare("DELETE FROM customers WHERE id = ? AND business_id = ?").run(id, businessId);
}
