import { createHmac, timingSafeEqual } from "node:crypto";
import { getDb } from "./db.ts";
import { TEXT_PLATFORMS, type TextPlatform } from "./text-platforms.ts";

export type { TextPlatform } from "./text-platforms.ts";
export { TEXT_PLATFORMS, textFieldCopy } from "./text-platforms.ts";

export type TextSettings = {
  platform: TextPlatform | "";
  accountId: string;
  fromNumber: string;
  hasSecret: boolean;
  ready: boolean;
};

type TextCredentials = {
  platform: TextPlatform;
  accountId: string;
  secret: string;
  fromNumber: string;
};

function ensureTextColumns() {
  const db = getDb();
  const columns = db.prepare("PRAGMA table_info(businesses)").all() as { name: string }[];
  const names = new Set(columns.map((column) => column.name));
  if (!names.has("text_platform")) db.exec("ALTER TABLE businesses ADD COLUMN text_platform TEXT NOT NULL DEFAULT ''");
  if (!names.has("text_account_id")) db.exec("ALTER TABLE businesses ADD COLUMN text_account_id TEXT NOT NULL DEFAULT ''");
  if (!names.has("text_secret")) db.exec("ALTER TABLE businesses ADD COLUMN text_secret TEXT NOT NULL DEFAULT ''");
  if (!names.has("text_from_number")) db.exec("ALTER TABLE businesses ADD COLUMN text_from_number TEXT NOT NULL DEFAULT ''");
  const logColumns = db.prepare("PRAGMA table_info(sms_log)").all() as { name: string }[];
  if (!logColumns.some((column) => column.name === "detail")) {
    db.exec("ALTER TABLE sms_log ADD COLUMN detail TEXT NOT NULL DEFAULT ''");
  }
}

function isPlatform(value: string): value is TextPlatform {
  return TEXT_PLATFORMS.some((platform) => platform.id === value);
}

export function toE164(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  // 12–15 digits can be a real international number. An 11-digit value that
  // does not start with 1 is not US E.164, and sending "+" plus those digits
  // makes Twilio reject it as an invalid To number.
  if (digits.length >= 12 && digits.length <= 15) return `+${digits}`;
  return null;
}

function unusableNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && !digits.startsWith("1")) {
    return "That phone number has 11 digits and does not start with 1, so it was not sent.";
  }
  return "That phone number is not a full number.";
}

function nationalNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

function ready(platform: TextPlatform | "", accountId: string, secret: string, fromNumber: string) {
  if (!platform || !secret) return false;
  if (platform === "simpletexting") return true;
  return Boolean(accountId && fromNumber);
}

export function textSettings(businessId: number): TextSettings {
  ensureTextColumns();
  const row = getDb()
    .prepare(
      `SELECT text_platform AS platform, text_account_id AS accountId, text_secret AS secret, text_from_number AS fromNumber
       FROM businesses WHERE id = ?`,
    )
    .get(businessId) as { platform: string; accountId: string; secret: string; fromNumber: string } | undefined;
  if (!row) throw new Error("That business is not on this desk.");
  const platform = isPlatform(row.platform) ? row.platform : "";
  return {
    platform,
    accountId: row.accountId,
    fromNumber: row.fromNumber,
    hasSecret: row.secret.length > 0,
    ready: ready(platform, row.accountId, row.secret, row.fromNumber),
  };
}

export function textCredentials(businessId: number): TextCredentials | null {
  const settings = textSettings(businessId);
  if (!settings.ready || !settings.platform) return null;
  const row = getDb()
    .prepare("SELECT text_secret AS secret FROM businesses WHERE id = ?")
    .get(businessId) as { secret: string };
  return {
    platform: settings.platform,
    accountId: settings.accountId,
    secret: row.secret,
    fromNumber: settings.fromNumber,
  };
}

export function saveTextSettings(
  businessId: number,
  input: { platform: string; accountId: string; secret: string; fromNumber: string },
) {
  ensureTextColumns();
  const platform = input.platform.trim();
  const accountId = input.accountId.trim();
  const fromNumber = input.fromNumber.trim();
  const typedSecret = input.secret.trim();
  if (!platform) {
    getDb()
      .prepare(
        `UPDATE businesses
         SET text_platform = '', text_account_id = '', text_secret = '', text_from_number = '', updated_at = ?
         WHERE id = ?`,
      )
      .run(new Date().toISOString(), businessId);
    return;
  }
  if (!isPlatform(platform)) throw new Error("Choose Sendblue, Twilio, or SimpleTexting.");
  if (platform === "twilio" && !/^AC[0-9a-fA-F]{32}$/.test(accountId)) {
    throw new Error("The Twilio Account SID starts with AC and is on the Twilio console homepage.");
  }
  if (platform === "sendblue" && accountId.length < 8) {
    throw new Error("Paste the Sendblue API key id from the Sendblue dashboard.");
  }
  const e164 = fromNumber ? toE164(fromNumber) : null;
  if (platform !== "simpletexting" && !e164) {
    throw new Error("Use the phone number texts should come from, including the area code.");
  }
  if (fromNumber && !e164) throw new Error("That sending number needs an area code.");
  const existing = textCredentials(businessId);
  const secret = typedSecret || (existing?.platform === platform ? existing.secret : "");
  if (secret.length < 8) throw new Error("Paste the API secret or token for that platform.");
  getDb()
    .prepare(
      `UPDATE businesses
       SET text_platform = ?, text_account_id = ?, text_secret = ?, text_from_number = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(platform, platform === "simpletexting" ? "" : accountId, secret, e164 ?? "", new Date().toISOString(), businessId);
}

async function readError(response: Response) {
  const json = (await response.json().catch(() => ({}))) as { message?: string; error?: string; detail?: string; status?: string };
  return json.message || json.detail || json.error || `The text platform returned ${response.status}.`;
}

export type TextDelivery = "accepted" | "delivered" | "sent" | "failed";

/** Twilio's create call returns queued/sent before the handset confirms delivery. */
export function twilioDeliveryStatus(status: string | undefined): Exclude<TextDelivery, "sent"> {
  const value = (status || "").toLowerCase();
  if (value === "delivered" || value === "read") return "delivered";
  if (value === "failed" || value === "undelivered" || value === "canceled") return "failed";
  return "accepted";
}

export function textStatusCallbackUrl(origin: string | undefined) {
  if (!origin) return "";
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:") return "";
    if (url.hostname === "tigeats.com") url.hostname = "www.tigeats.com";
    return `${url.origin}/api/twilio/status`;
  } catch {
    return "";
  }
}

export function twilioSignatureMatches(url: string, params: URLSearchParams, header: string, token: string) {
  if (!header || !token) return false;
  const entries = [...params.entries()].sort(([left], [right]) => left.localeCompare(right));
  let payload = url;
  for (const [key, value] of entries) payload += key + value;
  const expected = createHmac("sha1", token).update(payload).digest("base64");
  const actual = Buffer.from(header);
  const expectedBuffer = Buffer.from(expected);
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

export function textOutcomeLabel(status: string) {
  if (status === "delivered") return "delivered";
  if (status === "failed" || status === "undelivered") return "failed";
  if (status === "logged") return "logged";
  if (status === "sent" || status === "accepted" || status === "queued" || status === "sending") {
    return "accepted, not delivered";
  }
  return status;
}

export async function sendTextMessage(
  credentials: TextCredentials,
  to: string,
  body: string,
  statusCallback?: string,
) {
  const destination = toE164(to);
  if (!destination) return { ok: false as const, detail: unusableNumber(to), delivery: "failed" as const };
  try {
    if (credentials.platform === "twilio") {
      const payload = new URLSearchParams({ To: destination, From: credentials.fromNumber, Body: body });
      if (statusCallback) payload.set("StatusCallback", statusCallback);
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountId}/Messages.json`,
        {
          method: "POST",
          headers: {
            authorization: `Basic ${Buffer.from(`${credentials.accountId}:${credentials.secret}`).toString("base64")}`,
            "content-type": "application/x-www-form-urlencoded",
          },
          body: payload,
          signal: AbortSignal.timeout(12000),
        },
      );
      const json = (await response.json()) as {
        sid?: string;
        status?: string;
        message?: string;
        error_message?: string | null;
      };
      if (!response.ok) {
        return { ok: false as const, detail: json.message || json.error_message || `Twilio returned ${response.status}.`, delivery: "failed" as const };
      }
      const delivery = twilioDeliveryStatus(json.status);
      if (delivery === "failed") {
        return {
          ok: false as const,
          detail: json.error_message || json.message || "Twilio rejected the text before delivery.",
          delivery,
        };
      }
      return { ok: true as const, detail: json.sid || delivery, delivery };
    }
    if (credentials.platform === "simpletexting") {
      const response = await fetch("https://api-app2.simpletexting.com/v2/api/messages", {
        method: "POST",
        headers: {
          authorization: `Bearer ${credentials.secret}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          contactPhone: nationalNumber(destination),
          ...(credentials.fromNumber ? { accountPhone: nationalNumber(credentials.fromNumber) } : {}),
          mode: "AUTO",
          text: body,
        }),
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) return { ok: false as const, detail: await readError(response), delivery: "failed" as const };
      const json = (await response.json().catch(() => ({}))) as { id?: string };
      return { ok: true as const, detail: json.id || "sent", delivery: "sent" as const };
    }
    const response = await fetch("https://api.sendblue.com/api/send-message", {
      method: "POST",
      headers: {
        "sb-api-key-id": credentials.accountId,
        "sb-api-secret-key": credentials.secret,
        "content-type": "application/json",
      },
      body: JSON.stringify({ number: destination, from_number: credentials.fromNumber, content: body }),
      signal: AbortSignal.timeout(12000),
    });
    const json = (await response.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
      error_message?: string;
      status?: string;
      message_handle?: string;
    };
    if (!response.ok || json.status === "ERROR") {
      return {
        ok: false as const,
        detail: json.error_message || json.message || json.error || `Sendblue returned ${response.status}.`,
        delivery: "failed" as const,
      };
    }
    return { ok: true as const, detail: json.message_handle || json.status || "sent", delivery: "sent" as const };
  } catch (error) {
    return {
      ok: false as const,
      detail: error instanceof Error ? error.message : "The text platform could not be reached.",
      delivery: "failed" as const,
    };
  }
}
