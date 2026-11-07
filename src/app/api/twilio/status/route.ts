import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { textCredentials, twilioDeliveryStatus, twilioSignatureMatches } from "@/lib/messaging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function callbackUrl(request: Request) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const proto = request.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}/api/twilio/status`;
}

export async function POST(request: Request) {
  const params = new URLSearchParams(await request.text());
  const sid = params.get("MessageSid") || "";
  const incoming = twilioDeliveryStatus(params.get("MessageStatus") || "");
  const signature = request.headers.get("x-twilio-signature") || "";
  if (!sid || !signature) {
    return NextResponse.json({ error: "That Twilio status could not be read." }, { status: 400 });
  }

  const row = getDb()
    .prepare(
      `SELECT s.id AS id, s.status AS status, s.detail AS detail, c.business_id AS businessId
       FROM sms_log s
       JOIN campaigns c ON c.id = s.campaign_id
       WHERE s.detail = ? OR s.detail LIKE ?`,
    )
    .get(sid, `${sid} %`) as { id: number; status: string; detail: string; businessId: number } | undefined;
  if (!row) return NextResponse.json({ received: true });

  const credentials = textCredentials(row.businessId);
  if (!credentials || credentials.platform !== "twilio") {
    return NextResponse.json({ error: "That text is not on a Twilio account." }, { status: 400 });
  }
  if (!twilioSignatureMatches(callbackUrl(request), params, signature, credentials.secret)) {
    return NextResponse.json({ error: "That Twilio signature does not match." }, { status: 400 });
  }

  const errorCode = params.get("ErrorCode") || "";
  const reported = errorCode ? "failed" : incoming;
  const current = row.status;
  const keep =
    (current === "delivered" || current === "failed" || current === "undelivered") && reported === "accepted";
  const status = keep ? current : reported;
  const detail =
    status === "failed" || status === "undelivered"
      ? errorCode
        ? `${sid} Twilio error ${errorCode}.`
        : row.detail && row.detail !== sid
          ? row.detail
          : `${sid} Twilio could not deliver that text.`
      : sid;
  getDb().prepare("UPDATE sms_log SET status = ?, detail = ? WHERE id = ?").run(status, detail, row.id);
  return NextResponse.json({ received: true });
}
