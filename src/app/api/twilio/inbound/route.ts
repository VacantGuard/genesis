import { NextResponse } from "next/server";
import { matchInboundBusiness, receiveInboundText } from "@/lib/twilio-inbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function emptyReply() {
  return new NextResponse("<Response></Response>", {
    headers: { "content-type": "text/xml; charset=utf-8" },
  });
}

function requestUrl(request: Request) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const proto = request.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}/api/twilio/inbound`;
}

export async function POST(request: Request) {
  const params = new URLSearchParams(await request.text());
  const signature = request.headers.get("x-twilio-signature") || "";
  const messageSid = params.get("MessageSid") || "";
  if (!signature || !messageSid) {
    return NextResponse.json({ error: "That incoming text could not be read." }, { status: 400 });
  }
  const business = matchInboundBusiness(params.get("To") || "", requestUrl(request), params, signature);
  if (!business) {
    return NextResponse.json({ error: "That Twilio signature does not match." }, { status: 403 });
  }
  const received = await receiveInboundText({
    businessId: business.id,
    messageSid,
    from: params.get("From") || "",
    body: params.get("Body") || "",
    mediaCount: Number(params.get("NumMedia") || "0") || 0,
  });
  if (!received.duplicate && !received.posted && received.detail) {
    console.error("Inbound text Slack post failed", received.detail);
  }
  return emptyReply();
}
