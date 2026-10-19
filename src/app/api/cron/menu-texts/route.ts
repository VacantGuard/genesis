import { NextResponse } from "next/server";
import { businessForAgentToken } from "@/lib/agent";
import { sendDueMenuTexts } from "@/lib/menu-schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const allowed = token === process.env.CRON_SECRET?.trim() || Boolean(businessForAgentToken(token));
  if (!allowed) {
    return NextResponse.json({ error: "That token cannot run the weekly menu text." }, { status: 401 });
  }
  const sent = await sendDueMenuTexts();
  return NextResponse.json({ sent });
}
