import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { businessForAgentToken } from "@/lib/agent";
import { sendDueMenuTexts } from "@/lib/menu-schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearer(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

function cronSecretMatches(token: string) {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  if (!secret || token.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(secret));
}

async function runDueMenuTexts(request: Request) {
  const token = bearer(request);
  const allowed = cronSecretMatches(token) || Boolean(businessForAgentToken(token));
  if (!allowed) {
    return NextResponse.json({ error: "That token cannot run the weekly menu text." }, { status: 401 });
  }
  const sent = await sendDueMenuTexts();
  return NextResponse.json({ sent });
}

export function GET(request: Request) {
  return runDueMenuTexts(request);
}

export function POST(request: Request) {
  return runDueMenuTexts(request);
}
