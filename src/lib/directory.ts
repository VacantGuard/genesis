import { syncOrdersToCustomer } from "./customer-orders.ts";
import {
  deliveryLocateUrl,
  formatDeliveryAddress,
  type DeliveryAddress,
} from "./delivery.ts";
import { getDb } from "./db.ts";
import type { Company, Customer } from "./types.ts";

function ensureDeliveryColumns() {
  const db = getDb();
  for (const table of ["customers", "orders"] as const) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    const names = new Set(cols.map((col) => col.name));
    for (const column of [
      "delivery_line1",
      "delivery_line2",
      "delivery_city",
      "delivery_state",
      "delivery_postal_code",
    ]) {
      if (!names.has(column)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} TEXT NOT NULL DEFAULT ''`);
      }
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

function backfillSampleDeliveryAddresses(businessId: number) {
  ensureDeliveryColumns();
  const samples: { name: string; delivery: DeliveryAddress }[] = [
    {
      name: "Avery Cole",
      delivery: {
        line1: "410 N Wells St",
        line2: "Suite 400",
        city: "Chicago",
        state: "IL",
        postalCode: "60654",
      },
    },
    {
      name: "Morgan Ellis",
      delivery: {
        line1: "233 S Wacker Dr",
        line2: "Apt 12B",
        city: "Chicago",
        state: "IL",
        postalCode: "60606",
      },
    },
    {
      name: "Quinn Park",
      delivery: {
        line1: "1410 N Milwaukee Ave",
        line2: "",
        city: "Chicago",
        state: "IL",
        postalCode: "60622",
      },
    },
  ];
  const update = getDb().prepare(
    `UPDATE customers
     SET delivery_line1 = ?, delivery_line2 = ?, delivery_city = ?, delivery_state = ?, delivery_postal_code = ?
     WHERE business_id = ? AND name = ? AND TRIM(delivery_line1) = ''`,
  );
  for (const sample of samples) {
    update.run(
      sample.delivery.line1,
      sample.delivery.line2,
      sample.delivery.city,
      sample.delivery.state,
      sample.delivery.postalCode,
      businessId,
      sample.name,
    );
  }
}

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
    cu.notes,
    cu.delivery_line1 AS deliveryLine1,
    cu.delivery_line2 AS deliveryLine2,
    cu.delivery_city AS deliveryCity,
    cu.delivery_state AS deliveryState,
    cu.delivery_postal_code AS deliveryPostalCode
  FROM customers cu
  LEFT JOIN companies co ON co.id = cu.company_id
`;

function mapCustomer(
  row: Omit<Customer, "deliveryAddress" | "deliveryLocateUrl"> & {
    deliveryLine1?: string;
    deliveryLine2?: string;
    deliveryCity?: string;
    deliveryState?: string;
    deliveryPostalCode?: string;
  },
): Customer {
  return {
    id: row.id,
    clientNumber: row.clientNumber,
    name: row.name,
    phone: row.phone,
    email: row.email,
    companyId: row.companyId,
    companyName: row.companyName,
    notes: row.notes,
    ...withDelivery(row),
  };
}

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
  ensureDeliveryColumns();
  backfillSampleDeliveryAddresses(businessId);
  return (
    getDb()
      .prepare(
        `${customerSelect}
       WHERE cu.business_id = ?
       ORDER BY cu.name COLLATE NOCASE`,
      )
      .all(businessId) as Omit<Customer, "deliveryAddress" | "deliveryLocateUrl">[]
  ).map(mapCustomer);
}

export function getCustomer(businessId: number, id: number): Customer | null {
  ensureClientNumbers(businessId);
  ensureDeliveryColumns();
  const row = getDb()
    .prepare(`${customerSelect} WHERE cu.id = ? AND cu.business_id = ?`)
    .get(id, businessId) as Omit<Customer, "deliveryAddress" | "deliveryLocateUrl"> | undefined;
  return row ? mapCustomer(row) : null;
}

export function saveCustomer(input: {
  businessId: number;
  id?: number;
  name: string;
  phone: string;
  email: string;
  companyId: number | null;
  notes: string;
  delivery: DeliveryAddress;
}) {
  const db = getDb();
  ensureDeliveryColumns();
  if (input.companyId) {
    const company = getCompany(input.businessId, input.companyId);
    if (!company) return false;
  }
  if (input.id) {
    db.prepare(
      `UPDATE customers
       SET name = ?, phone = ?, email = ?, company_id = ?, notes = ?,
           delivery_line1 = ?, delivery_line2 = ?, delivery_city = ?,
           delivery_state = ?, delivery_postal_code = ?
       WHERE id = ? AND business_id = ?`,
    ).run(
      input.name,
      input.phone,
      input.email,
      input.companyId,
      input.notes,
      input.delivery.line1,
      input.delivery.line2,
      input.delivery.city,
      input.delivery.state,
      input.delivery.postalCode,
      input.id,
      input.businessId,
    );
    syncOrdersToCustomer(input.businessId, input.id, input.phone, input.email);
    return true;
  }
  const inserted = db
    .prepare(
      `INSERT INTO customers
        (name, phone, email, company_id, notes, business_id,
         delivery_line1, delivery_line2, delivery_city, delivery_state, delivery_postal_code, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.name,
      input.phone,
      input.email,
      input.companyId,
      input.notes,
      input.businessId,
      input.delivery.line1,
      input.delivery.line2,
      input.delivery.city,
      input.delivery.state,
      input.delivery.postalCode,
      new Date().toISOString(),
    );
  const customerId = Number(inserted.lastInsertRowid);
  ensureClientNumbers(input.businessId);
  syncOrdersToCustomer(input.businessId, customerId, input.phone, input.email);
  return true;
}

export function upsertCustomerDeliveryFromOrder(
  businessId: number,
  input: {
    customerName: string;
    phone: string;
    email: string;
    companyName: string;
    delivery: DeliveryAddress;
  },
) {
  ensureDeliveryColumns();
  const digits = input.phone.replace(/\D/g, "");
  if (digits.length < 7) return;
  const existing = listCustomers(businessId).find(
    (customer) => customer.phone.replace(/\D/g, "") === digits,
  );
  if (existing) {
    getDb()
      .prepare(
        `UPDATE customers
         SET name = ?, email = COALESCE(NULLIF(?, ''), email),
             delivery_line1 = ?, delivery_line2 = ?, delivery_city = ?,
             delivery_state = ?, delivery_postal_code = ?
         WHERE id = ? AND business_id = ?`,
      )
      .run(
        input.customerName,
        input.email,
        input.delivery.line1,
        input.delivery.line2,
        input.delivery.city,
        input.delivery.state,
        input.delivery.postalCode,
        existing.id,
        businessId,
      );
    return;
  }
  let companyId: number | null = null;
  if (input.companyName) {
    const company = listCompanies(businessId).find(
      (row) => row.name.toLowerCase() === input.companyName.toLowerCase(),
    );
    companyId = company?.id ?? null;
  }
  saveCustomer({
    businessId,
    name: input.customerName,
    phone: input.phone,
    email: input.email,
    companyId,
    notes: "",
    delivery: input.delivery,
  });
}

export function deleteCustomer(businessId: number, id: number) {
  getDb().prepare("DELETE FROM customers WHERE id = ? AND business_id = ?").run(id, businessId);
}
