import { listTriggers, orderBoard } from "./agent";
import { menuLink, type BusinessRecord } from "./businesses";
import { listCompanies, listCustomers } from "./directory";
import { formatMoney, formatWhen } from "./format";
import { getPublicMenu } from "./menu";

export function publicOrigin(request: Request) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const local = host.startsWith("127.") || host.startsWith("localhost") || host.startsWith("[::1]");
  const proto = request.headers.get("x-forwarded-proto") || (local ? "http" : "https");
  if (host && !host.startsWith("0.0.0.0")) return `${proto}://${host}`;
  return process.env.PUBLIC_BASE_URL;
}

export function renderMenuMemory(business: BusinessRecord, origin?: string) {
  const changes = listTriggers(business.id);
  const menu = getPublicMenu(business.id);
  const lines = [
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
  const board = orderBoard(business.id);
  lines.push("", "## Clients");
  const customers = listCustomers(business.id);
  if (customers.length === 0) {
    lines.push("No clients are saved. Add them on the Customers page. An order is matched to a client by phone.");
  }
  for (const customer of customers) {
    const contact = [customer.phone, customer.email].filter(Boolean).join(", ");
    const company = customer.companyName ? ` (${customer.companyName})` : "";
    lines.push(`- ${customer.name}${company}${contact ? ` — ${contact}` : ""}`);
  }
  lines.push("", "## Who paid");
  lines.push("Paid means a checkout order since the latest menu update. Match is by phone, then by name.");
  if (!board.trigger) lines.push("No menu update is saved yet, so this list is every order on the desk.");
  if (board.ordered.length === 0) {
    lines.push("Nobody has paid since that menu update.");
  }
  for (const order of board.ordered) {
    const contact = [order.phone, order.email].filter(Boolean).join(", ");
    lines.push(
      `- ${order.name}${contact ? ` — ${contact}` : ""} — paid — order ${order.orderNumber} — ${formatWhen(order.createdAt)}`,
    );
  }
  lines.push("", "## Who has not paid");
  if (board.notOrdered.length === 0) {
    lines.push("Every saved client has paid since that menu update.");
  }
  for (const client of board.notOrdered) {
    const contact = [client.phone, client.email].filter(Boolean).join(", ");
    lines.push(`- ${client.name}${contact ? ` — ${contact}` : ""} — not paid`);
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
