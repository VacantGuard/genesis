import { listTriggers, orderBoard } from "./agent";
import { menuLink, type BusinessRecord } from "./businesses";
import { listCompanies, listCustomers } from "./directory";
import { formatMoney, formatWhen } from "./format";
import { getPublicMenu } from "./menu";
import { getMenuTextSchedule, scheduleReport } from "./menu-schedule";

export function publicOrigin(request: Request) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const local = host.startsWith("127.") || host.startsWith("localhost") || host.startsWith("[::1]");
  const proto = request.headers.get("x-forwarded-proto") || (local ? "http" : "https");
  if (host && !host.startsWith("0.0.0.0")) return `${proto}://${host}`;
  return process.env.PUBLIC_BASE_URL;
}

export function paymentBoard(business: BusinessRecord) {
  const board = orderBoard(business.id);
  const paid = board.ordered.map((order) => ({
    clientNumber: order.clientNumber,
    name: order.name,
    phone: order.phone,
    orderNumber: order.orderNumber,
  }));
  const notPaid = board.notOrdered.map((client) => ({
    clientNumber: client.clientNumber,
    name: client.name,
    phone: client.phone,
  }));
  return { since: board.trigger?.createdAt ?? null, paid, notPaid };
}

export function renderPaymentBoard(business: BusinessRecord) {
  const board = paymentBoard(business);
  const lines = [
    `# ${business.name} payments`,
    board.since
      ? `Since the latest menu update (${formatWhen(board.since)}). Each client has a client number. Paid means a checkout matched by phone.`
      : "No menu update is saved yet. Each client has a client number. Paid means any checkout on the desk, matched by phone.",
    "",
    "## Paid",
  ];
  if (board.paid.length === 0) lines.push("Nobody has paid.");
  for (const client of board.paid) {
    lines.push(`- ${client.clientNumber || "—"} | ${client.name} | ${client.phone} | ${client.orderNumber}`);
  }
  lines.push("", "## Not paid");
  if (board.notPaid.length === 0) lines.push("Every saved client has paid.");
  for (const client of board.notPaid) {
    lines.push(`- ${client.clientNumber || "—"} | ${client.name} | ${client.phone}`);
  }
  lines.push("");
  return lines.join("\n");
}

export function renderMenuMemory(business: BusinessRecord, origin?: string) {
  const changes = listTriggers(business.id);
  const menu = getPublicMenu(business.id);
  const schedule = scheduleReport(getMenuTextSchedule(business.id));
  const lines = [
    "# What this page answers",
    "Payments, the weekly menu, saved clients, and the weekly menu text schedule. Quote the section that answers the question. Every status includes a reason. Do not say a reason is missing.",
    "",
    "## Weekly menu text",
    schedule.summary,
    "",
    renderPaymentBoard(business).trimEnd(),
    "",
    `# ${business.name} weekly menu`,
    "",
    `Public menu: ${menuLink(business.slug, origin)}`,
    "",
    "## What changed",
  ];
  if (changes.length === 0) {
    lines.push("No menu change has been saved yet.");
  } else {
    for (const change of changes) {
      lines.push(`- ${formatWhen(change.createdAt)} — ${change.summary}`);
    }
  }
  lines.push("", "## Menu now");
  if (menu.every((category) => category.items.length === 0)) {
    lines.push("The weekly menu is empty.");
  }
  for (const category of menu) {
    if (category.items.length === 0) continue;
    lines.push("", `### ${category.name}`);
    for (const item of category.items) {
      const state = item.available ? "available" : "unavailable";
      lines.push(`- ${item.name} — ${formatMoney(item.priceCents)} — ${state}`);
      if (item.description) lines.push(`  ${item.description}`);
    }
  }
  lines.push("", "## Clients");
  const customers = listCustomers(business.id);
  if (customers.length === 0) {
    lines.push("No clients are saved. Add them on the Customers page. Each client gets a client number. An order is matched to that client by phone.");
  }
  for (const customer of customers) {
    const contact = [customer.phone, customer.email].filter(Boolean).join(", ");
    const company = customer.companyName ? ` (${customer.companyName})` : "";
    const delivery = customer.deliveryAddress
      ? ` — deliver ${customer.deliveryAddress}${customer.deliveryLocateUrl ? ` | locate ${customer.deliveryLocateUrl}` : ""}`
      : "";
    lines.push(
      `- ${customer.clientNumber} | ${customer.name}${company}${contact ? ` — ${contact}` : ""}${delivery}`,
    );
  }
  const companies = listCompanies(business.id);
  if (companies.length > 0) {
    lines.push("", "## Company contacts");
    for (const company of companies) {
      const who = company.contactName || company.name;
      const contact = [company.phone, company.email].filter(Boolean).join(", ");
      lines.push(`- ${who} at ${company.name}${contact ? ` — ${contact}` : ""}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

export function renderMenuMemoryPage(business: BusinessRecord, origin?: string) {
  const text = renderMenuMemory(business, origin)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${business.name} menu memory</title></head><body><pre>${text}</pre></body></html>\n`;
}
