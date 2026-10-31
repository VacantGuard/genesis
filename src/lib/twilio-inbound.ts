import { getDb } from "./db.ts";
import { rememberedOrigin } from "./businesses.ts";
import { postBusinessSlack } from "./slack-post.ts";
import { ensureTextColumns, textCredentials, toE164, twilioSignatureMatches } from "./messaging.ts";

export function twilioInboundUrl(origin: string | undefined) {
  if (!origin) return "";
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:") return "";
    if (url.hostname === "tigeats.com") url.hostname = "www.tigeats.com";
    return `${url.origin}/api/twilio/inbound`;
  } catch {
    return "";
  }
}

function ensureInboundTable() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS inbound_texts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      message_sid TEXT NOT NULL UNIQUE,
      from_phone TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

function digits(phone: string) {
  return phone.replace(/\D/g, "");
}

function sameNumber(left: string, right: string) {
  const a = digits(left);
  const b = digits(right);
  if (!a || !b) return false;
  return a === b || a.endsWith(b) || b.endsWith(a);
}

type TwilioBusiness = { id: number; fromNumber: string; secret: string };

function twilioBusinesses(): TwilioBusiness[] {
  ensureTextColumns();
  return getDb()
    .prepare(
      `SELECT id, text_from_number AS fromNumber, text_secret AS secret
       FROM businesses WHERE text_platform = 'twilio' AND text_secret != ''`,
    )
    .all() as TwilioBusiness[];
}

export function matchInboundBusiness(to: string, url: string, params: URLSearchParams, signature: string) {
  const rows = twilioBusinesses().filter((row) => !to || sameNumber(row.fromNumber, to));
  const candidates = rows.length > 0 ? rows : twilioBusinesses();
  return candidates.find((row) => twilioSignatureMatches(url, params, signature, row.secret)) ?? null;
}

export function claimInboundText(businessId: number, messageSid: string, fromPhone: string, body: string) {
  ensureInboundTable();
  const inserted = getDb()
    .prepare(
      `INSERT INTO inbound_texts (business_id, message_sid, from_phone, body, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(message_sid) DO NOTHING`,
    )
    .run(businessId, messageSid, fromPhone, body.slice(0, 1600), new Date().toISOString());
  return inserted.changes === 1;
}

export function inboundSlackText(input: { from: string; body: string; mediaCount: number }) {
  const said = input.body.trim() || "(no message)";
  const sentence = /[.!?]$/.test(said) ? said : `${said}.`;
  const photo = input.mediaCount > 0 ? " A photo was attached." : "";
  return `Text from ${input.from}: ${sentence}${photo}`;
}

export async function receiveInboundText(input: {
  businessId: number;
  messageSid: string;
  from: string;
  body: string;
  mediaCount: number;
}) {
  const fresh = claimInboundText(input.businessId, input.messageSid, input.from, input.body);
  if (!fresh) return { posted: false, duplicate: true, detail: "" };
  const posted = await postBusinessSlack(
    input.businessId,
    "texts",
    inboundSlackText({ from: input.from, body: input.body, mediaCount: input.mediaCount }),
  );
  return { posted: posted.ok, duplicate: false, detail: posted.detail };
}

export async function pointTwilioAtInbound(businessId: number) {
  const credentials = textCredentials(businessId);
  if (!credentials || credentials.platform !== "twilio") {
    return { ok: false, detail: "Twilio is not connected, so incoming texts are not pointed at Slack yet." };
  }
  const inboundUrl = twilioInboundUrl(rememberedOrigin(businessId) || "https://www.tigeats.com");
  const from = toE164(credentials.fromNumber);
  if (!inboundUrl || !from) {
    return { ok: false, detail: "The Twilio number needs a full phone number before incoming texts can post to Slack." };
  }
  const auth = `Basic ${Buffer.from(`${credentials.accountId}:${credentials.secret}`).toString("base64")}`;
  try {
    const listed = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountId}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(from)}`,
      { headers: { authorization: auth }, signal: AbortSignal.timeout(8000) },
    );
    const list = (await listed.json()) as {
      incoming_phone_numbers?: { sid: string; sms_url?: string; sms_method?: string }[];
      message?: string;
    };
    const number = list.incoming_phone_numbers?.[0];
    if (!listed.ok || !number) {
      return { ok: false, detail: list.message || "That Twilio number was not found on the account." };
    }
    if (number.sms_url === inboundUrl && (number.sms_method || "POST").toUpperCase() === "POST") {
      return { ok: true, detail: "Incoming texts already come to this site." };
    }
    const updated = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountId}/IncomingPhoneNumbers/${number.sid}.json`,
      {
        method: "POST",
        headers: { authorization: auth, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ SmsUrl: inboundUrl, SmsMethod: "POST" }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!updated.ok) {
      const failure = (await updated.json()) as { message?: string };
      return { ok: false, detail: failure.message || "Twilio did not save the incoming text address." };
    }
    return { ok: true, detail: "Incoming texts now come to this site and post in Slack." };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : "Twilio could not be reached.",
    };
  }
}
