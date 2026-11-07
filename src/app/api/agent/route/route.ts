import { NextResponse } from "next/server";
import { businessForAgentToken } from "@/lib/agent";
import { deliveryRoute, sendDriverRoute } from "@/lib/driver-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function agentBusiness(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  return businessForAgentToken(token);
}

function phonesFrom(value: unknown) {
  if (Array.isArray(value)) return value.map((phone) => String(phone));
  if (typeof value === "string") return value.split(/[,\n]/);
  return [];
}

export async function GET(request: Request) {
  const business = agentBusiness(request);
  if (!business) {
    return NextResponse.json({ error: "That agent token does not match this business." }, { status: 401 });
  }
  const date = new URL(request.url).searchParams.get("date") ?? "";
  try {
    return NextResponse.json({ business: business.name, ...(await deliveryRoute(business.id, date)) });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "The route could not be built.";
    return NextResponse.json({ error: detail }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const business = agentBusiness(request);
  if (!business) {
    return NextResponse.json({ error: "That agent token does not match this business." }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { date?: unknown; phones?: unknown } | null;
  const date = typeof body?.date === "string" ? body.date : "";
  try {
    const result = await sendDriverRoute({
      businessId: business.id,
      date,
      phones: phonesFrom(body?.phones),
    });
    return NextResponse.json({
      business: business.name,
      sent: result.sent,
      detail: result.detail,
      results: result.results,
      ...result.route,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "The route could not be sent.";
    return NextResponse.json({ error: detail }, { status: 400 });
  }
}
