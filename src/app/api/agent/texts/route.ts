import { NextResponse } from "next/server";
import { businessForAgentToken } from "@/lib/agent";
import { menuLink } from "@/lib/businesses";
import { publicOrigin } from "@/lib/menu-memory";
import { sendCampaign } from "@/lib/texts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const business = businessForAgentToken(token);
  if (!business) {
    return NextResponse.json({ error: "That agent token does not match this business." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    message?: unknown;
    includeCustomers?: unknown;
    includeCompanyContacts?: unknown;
  } | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (message.length < 2 || message.length > 480) {
    return NextResponse.json({ error: "Write a message between 2 and 480 characters." }, { status: 400 });
  }
  const includeCustomers = body?.includeCustomers !== false;
  const includeCompanyContacts = body?.includeCompanyContacts === true;
  if (!includeCustomers && !includeCompanyContacts) {
    return NextResponse.json({ error: "Choose customers, company contacts, or both." }, { status: 400 });
  }

  try {
    const result = await sendCampaign({
      businessId: business.id,
      message,
      linkUrl: menuLink(business.slug, publicOrigin(request)),
      includeCustomers,
      includeCompanyContacts,
    });
    return NextResponse.json({
      business: business.name,
      recipientCount: result.recipientCount,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      mode: result.mode,
      linkUrl: result.linkUrl,
      recipients: result.recipients,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "The text could not be sent.";
    return NextResponse.json({ error: detail }, { status: 400 });
  }
}
