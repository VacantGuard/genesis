import { randomBytes } from "node:crypto";
import { menuLink, type BusinessRecord } from "./businesses.ts";
import { getDb } from "./db.ts";
import { listCompanies, listCustomers } from "./directory.ts";

export type MenuClient = {
  name: string;
  phone: string;
  email: string;
  kind: "customer" | "company_contact";
};

export type OrderMatch = {
  name: string;
  phone: string;
  email: string;
  orderNumber: string;
  createdAt: string;
};

export type MenuTrigger = {
  id: number;
  summary: string;
  menuUrl: string;
  clientCount: number;
  delivery: "sent" | "not_connected" | "failed";
  detail: string;
  createdAt: string;
};

type OrderRow = {
  orderNumber: string;
  createdAt: string;
  customerName: string;
  phone: string;
};

function ensureAgentSchema() {
  const db = getDb();
  const columns = db.prepare("PRAGMA table_info(businesses)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "n8n_webhook_url")) {
    db.exec("ALTER TABLE businesses ADD COLUMN n8n_webhook_url TEXT NOT NULL DEFAULT ''");
  }
  if (!columns.some((column) => column.name === "agent_token")) {
    db.exec("ALTER TABLE businesses ADD COLUMN agent_token TEXT");
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS menu_triggers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      summary TEXT NOT NULL,
      menu_url TEXT NOT NULL,
      clients_json TEXT NOT NULL,
      delivery TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
  `);
}

function digits(phone: string) {
  return phone.replace(/\D/g, "");
}

export function agentSettings(businessId: number) {
  ensureAgentSchema();
  const db = getDb();
  const row = db
    .prepare("SELECT n8n_webhook_url AS webhookUrl, agent_token AS token FROM businesses WHERE id = ?")
    .get(businessId) as { webhookUrl: string; token: string | null } | undefined;
  if (!row) throw new Error("That business is not on this desk.");
  if (row.token) return row;
  const token = randomBytes(24).toString("hex");
  db.prepare("UPDATE businesses SET agent_token = ? WHERE id = ?").run(token, businessId);
  return { webhookUrl: row.webhookUrl, token };
}

export function saveAgentWebhook(businessId: number, webhookUrl: string) {
  ensureAgentSchema();
  const trimmed = webhookUrl.trim();
  if (trimmed) {
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new Error("Paste the n8n webhook URL, including https://.");
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("The n8n webhook URL needs to start with http:// or https://.");
    }
  }
  getDb().prepare("UPDATE businesses SET n8n_webhook_url = ?, updated_at = ? WHERE id = ?").run(
    trimmed,
    new Date().toISOString(),
    businessId,
  );
}

export function businessForAgentToken(token: string): BusinessRecord | null {
  ensureAgentSchema();
  if (!token) return null;
  const row = getDb()
    .prepare(
      `SELECT id, slug, name, about,
              is_homepage AS isHomepage, is_sample AS isSample,
              slack_team_id AS slackTeamId, slack_team_name AS slackTeamName
       FROM businesses WHERE agent_token = ?`,
    )
    .get(token) as
    | (Omit<BusinessRecord, "isHomepage" | "isSample"> & { isHomepage: number; isSample: number })
    | undefined;
  if (!row) return null;
  return { ...row, isHomepage: row.isHomepage === 1, isSample: row.isSample === 1 };
}

function ordersSince(businessId: number, since: string | null): OrderRow[] {
  const sql = since
    ? `SELECT order_number AS orderNumber, created_at AS createdAt, customer_name AS customerName, phone
       FROM orders WHERE business_id = ? AND created_at >= ? ORDER BY id DESC`
    : `SELECT order_number AS orderNumber, created_at AS createdAt, customer_name AS customerName, phone
       FROM orders WHERE business_id = ? ORDER BY id DESC`;
  const statement = getDb().prepare(sql);
  return (since ? statement.all(businessId, since) : statement.all(businessId)) as OrderRow[];
}

export function orderBoard(businessId: number) {
  ensureAgentSchema();
  const trigger = latestTrigger(businessId);
  const orders = ordersSince(businessId, trigger?.createdAt ?? null);
  const used = new Set<number>();
  const ordered: OrderMatch[] = [];
  const notOrdered: MenuClient[] = [];
  for (const customer of listCustomers(businessId)) {
    const phone = digits(customer.phone);
    const match = orders.findIndex((order, index) => {
      if (used.has(index)) return false;
      const orderPhone = digits(order.phone);
      if (phone.length >= 7 && orderPhone === phone) return true;
      return customer.name.toLowerCase() === order.customerName.toLowerCase();
    });
    if (match < 0) {
      notOrdered.push({
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        kind: "customer",
      });
      continue;
    }
    used.add(match);
    ordered.push({
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      orderNumber: orders[match].orderNumber,
      createdAt: orders[match].createdAt,
    });
  }
  orders.forEach((order, index) => {
    if (used.has(index)) return;
    ordered.push({
      name: order.customerName,
      phone: order.phone,
      email: "",
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
    });
  });
  return { trigger, ordered, notOrdered };
}

function menuClients(businessId: number): MenuClient[] {
  const clients: MenuClient[] = listCustomers(businessId).map((customer) => ({
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    kind: "customer",
  }));
  for (const company of listCompanies(businessId)) {
    if (digits(company.phone).length < 7) continue;
    clients.push({
      name: company.contactName || company.name,
      phone: company.phone,
      email: company.email,
      kind: "company_contact",
    });
  }
  return clients;
}

export function latestTrigger(businessId: number): MenuTrigger | null {
  ensureAgentSchema();
  const row = getDb()
    .prepare(
      `SELECT id, summary, menu_url AS menuUrl, clients_json AS clientsJson, delivery, detail, created_at AS createdAt
       FROM menu_triggers WHERE business_id = ? ORDER BY id DESC LIMIT 1`,
    )
    .get(businessId) as (Omit<MenuTrigger, "clientCount"> & { clientsJson: string }) | undefined;
  if (!row) return null;
  const clients = JSON.parse(row.clientsJson) as MenuClient[];
  return {
    id: row.id,
    summary: row.summary,
    menuUrl: row.menuUrl,
    clientCount: clients.length,
    delivery: row.delivery,
    detail: row.detail,
    createdAt: row.createdAt,
  };
}

export function listTriggers(businessId: number): MenuTrigger[] {
  ensureAgentSchema();
  const rows = getDb()
    .prepare(
      `SELECT id, summary, menu_url AS menuUrl, clients_json AS clientsJson, delivery, detail, created_at AS createdAt
       FROM menu_triggers WHERE business_id = ? ORDER BY id DESC LIMIT 8`,
    )
    .all(businessId) as (Omit<MenuTrigger, "clientCount"> & { clientsJson: string })[];
  return rows.map((row) => ({
    id: row.id,
    summary: row.summary,
    menuUrl: row.menuUrl,
    clientCount: (JSON.parse(row.clientsJson) as MenuClient[]).length,
    delivery: row.delivery,
    detail: row.detail,
    createdAt: row.createdAt,
  }));
}

export async function publishMenuUpdate(input: { business: BusinessRecord; summary: string; origin?: string }) {
  ensureAgentSchema();
  const menuUrl = menuLink(input.business.slug, input.origin);
  const clients = menuClients(input.business.id);
  const createdAt = new Date().toISOString();
  const inserted = getDb()
    .prepare(
      `INSERT INTO menu_triggers (business_id, summary, menu_url, clients_json, delivery, detail, created_at)
       VALUES (?, ?, ?, ?, 'not_connected', '', ?)`,
    )
    .run(input.business.id, input.summary, menuUrl, JSON.stringify(clients), createdAt);
  const triggerId = Number(inserted.lastInsertRowid);
  const board = orderBoard(input.business.id);
  const settings = agentSettings(input.business.id);
  let delivery: MenuTrigger["delivery"] = settings.webhookUrl ? "sent" : "not_connected";
  let detail = settings.webhookUrl ? "" : "No n8n webhook is saved on the Agent page.";
  if (settings.webhookUrl) {
    try {
      const response = await fetch(settings.webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event: "menu.updated",
          triggerId,
          business: input.business.name,
          slug: input.business.slug,
          slackTeamId: input.business.slackTeamId,
          summary: input.summary,
          menuUrl,
          clients,
          ordered: board.ordered,
          notOrdered: board.notOrdered,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        delivery = "failed";
        detail = `n8n returned ${response.status}.`;
      }
    } catch (error) {
      delivery = "failed";
      detail = error instanceof Error ? error.message : "The n8n webhook could not be reached.";
    }
  }
  getDb().prepare("UPDATE menu_triggers SET delivery = ?, detail = ? WHERE id = ?").run(delivery, detail, triggerId);
  return { triggerId, delivery, detail, clientCount: clients.length, menuUrl };
}
