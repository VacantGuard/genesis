import { NextResponse } from "next/server";
import { getAgentSettings, listClientsForAgent } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Agent-facing client list with delivery drop locations.
 * Each client includes structured address fields plus `delivery.locateUrl`
 * (Google Maps search) so the Slack / n8n agent can open the drop pin.
 *
 * `publicSiteUrl` / `menuLinkUrl` come from Terminal → Agent and stay pinned
 * (they do not follow the request host).
 *
 * Optional `?q=` filters by name, phone, email, or company.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  const settings = getAgentSettings();
  const all = listClientsForAgent();
  const clients = q
    ? all.filter((client) => {
        const haystack = [
          client.name,
          client.phone,
          client.email,
          client.companyName,
          client.delivery.formatted,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
    : all;

  return NextResponse.json({
    publicSiteUrl: settings.publicSiteUrl || null,
    menuLinkUrl: settings.menuLinkUrl || null,
    clients,
    count: clients.length,
    withDelivery: clients.filter((client) => Boolean(client.delivery.formatted)).length,
    query: q || null,
  });
}
