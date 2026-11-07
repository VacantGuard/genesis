import { NextResponse } from "next/server";
import { businessForAgentToken, orderBoard } from "@/lib/agent";
import { menuLink, rememberedOrigin } from "@/lib/businesses";
import { getMenuTextSchedule, scheduleReport } from "@/lib/menu-schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const business = businessForAgentToken(token);
  if (!business) {
    return NextResponse.json({ error: "That agent token does not match this business." }, { status: 401 });
  }
  const board = orderBoard(business.id);
  const schedule = scheduleReport(getMenuTextSchedule(business.id));
  const origin = rememberedOrigin(business.id) || undefined;
  return NextResponse.json({
    business: business.name,
    slug: business.slug,
    slackTeamId: business.slackTeamId,
    publicSiteUrl: origin || null,
    menuUrl: menuLink(business.slug, origin),
    weeklyMenuText: schedule,
    latestTrigger: board.trigger,
    ordered: board.ordered,
    notOrdered: board.notOrdered,
  });
}
