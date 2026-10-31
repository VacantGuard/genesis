import { createHmac, timingSafeEqual } from "node:crypto";
import { getDb } from "./db";

const PUBLISHABLE = /^pk_(test|live)_[A-Za-z0-9]+$/;
const SECRET = /^sk_(test|live)_[A-Za-z0-9]+$/;
const WEBHOOK = /^whsec_[A-Za-z0-9]+$/;

export type StripeSettings = {
  publishableKey: string;
  hasSecret: boolean;
  hasWebhookSecret: boolean;
  connected: boolean;
  missing: string[];
};

type PaymentIntent = {
  id: string;
  status: string;
  amount: number;
  client_secret?: string | null;
  metadata?: Record<string, string>;
  last_payment_error?: { message?: string };
  latest_charge?: {
    payment_method_details?: { card?: { last4?: string; wallet?: { type?: string } } };
  } | string | null;
};

function ensureStripeColumns() {
  const db = getDb();
  const columns = db.prepare("PRAGMA table_info(businesses)").all() as { name: string }[];
  const names = new Set(columns.map((column) => column.name));
  if (!names.has("stripe_publishable_key")) {
    db.exec("ALTER TABLE businesses ADD COLUMN stripe_publishable_key TEXT NOT NULL DEFAULT ''");
  }
  if (!names.has("stripe_secret_key")) {
    db.exec("ALTER TABLE businesses ADD COLUMN stripe_secret_key TEXT NOT NULL DEFAULT ''");
  }
  if (!names.has("stripe_webhook_secret")) {
    db.exec("ALTER TABLE businesses ADD COLUMN stripe_webhook_secret TEXT NOT NULL DEFAULT ''");
  }
}

function row(businessId: number) {
  ensureStripeColumns();
  return getDb()
    .prepare(
      `SELECT stripe_publishable_key AS publishableKey, stripe_secret_key AS secretKey,
              stripe_webhook_secret AS webhookSecret
       FROM businesses WHERE id = ?`,
    )
    .get(businessId) as { publishableKey: string; secretKey: string; webhookSecret: string } | undefined;
}

function missingLabels(keys: { publishableKey: string; secretKey: string; webhookSecret: string }) {
  const missing: string[] = [];
  if (!PUBLISHABLE.test(keys.publishableKey)) missing.push("Publishable key, starting with pk_test_ or pk_live_");
  if (!SECRET.test(keys.secretKey)) missing.push("Secret key, starting with sk_test_ or sk_live_");
  if (!WEBHOOK.test(keys.webhookSecret)) missing.push("Webhook secret, starting with whsec_");
  return missing;
}

export function stripeSettings(businessId: number): StripeSettings {
  const keys = row(businessId);
  if (!keys) throw new Error("That business is not on this desk.");
  const missing = missingLabels(keys);
  return {
    publishableKey: PUBLISHABLE.test(keys.publishableKey) ? keys.publishableKey : "",
    hasSecret: SECRET.test(keys.secretKey),
    hasWebhookSecret: WEBHOOK.test(keys.webhookSecret),
    connected: missing.length === 0,
    missing,
  };
}

export function stripePublishableKey(businessId: number) {
  const settings = stripeSettings(businessId);
  return settings.connected ? settings.publishableKey : null;
}

function stripeSecret(businessId: number) {
  const keys = row(businessId);
  if (!keys || missingLabels(keys).length > 0) return null;
  return keys.secretKey;
}

export function saveStripeSettings(
  businessId: number,
  input: { publishableKey: string; secretKey: string; webhookSecret: string; disconnect?: boolean },
) {
  ensureStripeColumns();
  if (input.disconnect) {
    getDb()
      .prepare(
        `UPDATE businesses
         SET stripe_publishable_key = '', stripe_secret_key = '', stripe_webhook_secret = '', updated_at = ?
         WHERE id = ?`,
      )
      .run(new Date().toISOString(), businessId);
    return;
  }
  const current = row(businessId);
  if (!current) throw new Error("That business is not on this desk.");
  const publishableKey = input.publishableKey.trim() || current.publishableKey;
  const secretKey = input.secretKey.trim() || current.secretKey;
  const webhookSecret = input.webhookSecret.trim() || current.webhookSecret;
  if (!PUBLISHABLE.test(publishableKey)) {
    throw new Error("The publishable key starts with pk_test_ or pk_live_.");
  }
  if (!SECRET.test(secretKey)) throw new Error("The secret key starts with sk_test_ or sk_live_.");
  if (!WEBHOOK.test(webhookSecret)) throw new Error("The webhook secret starts with whsec_.");
  const mode = publishableKey.startsWith("pk_live_") ? "live" : "test";
  if (!secretKey.startsWith(`sk_${mode}_`)) {
    throw new Error("Use a secret key from the same Stripe mode as the publishable key.");
  }
  getDb()
    .prepare(
      `UPDATE businesses
       SET stripe_publishable_key = ?, stripe_secret_key = ?, stripe_webhook_secret = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(publishableKey, secretKey, webhookSecret, new Date().toISOString(), businessId);
}

async function stripeRequest(secretKey: string, path: string, method: "GET" | "POST", fields?: Record<string, string>) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      authorization: `Bearer ${secretKey}`,
      ...(fields ? { "content-type": "application/x-www-form-urlencoded" } : {}),
    },
    body: fields ? new URLSearchParams(fields) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const json = (await response.json().catch(() => ({}))) as PaymentIntent & { error?: { message?: string } };
  if (!response.ok) {
    const message = json.error?.message || `Stripe returned ${response.status}.`;
    if (response.status === 401) {
      throw new Error("Stripe rejected the secret key saved under Business. The card was not charged.");
    }
    throw new Error(message);
  }
  return json;
}

function paymentDetails(intent: PaymentIntent) {
  const charge = intent.latest_charge;
  if (!charge || typeof charge === "string") return { last4: "", wallet: "" };
  const card = charge.payment_method_details?.card;
  return { last4: card?.last4 || "", wallet: card?.wallet?.type || "" };
}

const applePayDomainsReady = new Set<string>();

export async function ensureApplePayDomains(businessId: number, hosts: string[]) {
  const secretKey = stripeSecret(businessId);
  if (!secretKey) return;
  const names = new Set<string>();
  for (const host of hosts) {
    const domain = host.split(",")[0]?.trim().toLowerCase().split(":")[0] ?? "";
    if (!domain || domain === "localhost" || domain.endsWith(".local") || /^\d+\.\d+\.\d+\.\d+$/.test(domain)) continue;
    names.add(domain);
    if (domain.startsWith("www.")) names.add(domain.slice(4));
    else names.add(`www.${domain}`);
  }
  for (const domain of names) {
    const cacheKey = `${businessId}:${domain}`;
    if (applePayDomainsReady.has(cacheKey)) continue;
    try {
      const listed = (await stripeRequest(secretKey, "payment_method_domains?limit=100", "GET")) as {
        data?: { id?: string; domain_name?: string; apple_pay?: { status?: string } }[];
      };
      let record = listed.data?.find((item) => item.domain_name === domain);
      if (!record?.id) {
        record = (await stripeRequest(secretKey, "payment_method_domains", "POST", { domain_name: domain })) as {
          id?: string;
          apple_pay?: { status?: string };
        };
      }
      if (record?.id && record.apple_pay?.status !== "active") {
        record = (await stripeRequest(secretKey, `payment_method_domains/${record.id}/validate`, "POST")) as {
          id?: string;
          apple_pay?: { status?: string };
        };
      }
      if (record?.apple_pay?.status === "active") applePayDomainsReady.add(cacheKey);
    } catch (error) {
      console.error("Apple Pay domain registration failed", domain, error instanceof Error ? error.message : error);
    }
  }
}

function metadataFields(metadata: Record<string, string>) {
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    fields[`metadata[${key}]`] = value.slice(0, 500);
  }
  return fields;
}

export async function openCheckout(input: {
  businessId: number;
  amountCents: number;
  paymentIntentId?: string;
  metadata: Record<string, string>;
}) {
  const secretKey = stripeSecret(input.businessId);
  if (!secretKey) return { ok: false as const, error: "Stripe is not connected, so this checkout cannot take payment." };
  if (!Number.isInteger(input.amountCents) || input.amountCents < 50) {
    return { ok: false as const, error: "Stripe can charge this order only when the total is at least $0.50." };
  }
  const reusable = ["requires_payment_method", "requires_confirmation", "requires_action"];
  try {
    const existingId = input.paymentIntentId?.trim() ?? "";
    if (/^pi_[A-Za-z0-9]+$/.test(existingId)) {
      const current = await stripeRequest(secretKey, `payment_intents/${existingId}`, "GET");
      if (current.metadata?.businessId === String(input.businessId) && reusable.includes(current.status)) {
        const updated = await stripeRequest(secretKey, `payment_intents/${existingId}`, "POST", {
          amount: String(input.amountCents),
          currency: "usd",
          ...metadataFields(input.metadata),
        });
        if (updated.client_secret) {
          return { ok: true as const, paymentIntentId: updated.id, clientSecret: updated.client_secret };
        }
      }
    }
    const created = await stripeRequest(secretKey, "payment_intents", "POST", {
      amount: String(input.amountCents),
      currency: "usd",
      "automatic_payment_methods[enabled]": "true",
      ...metadataFields(input.metadata),
    });
    if (!created.client_secret) return { ok: false as const, error: "Checkout could not start." };
    return { ok: true as const, paymentIntentId: created.id, clientSecret: created.client_secret };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Checkout could not start." };
  }
}

export async function chargeCard(input: {
  businessId: number;
  amountCents: number;
  paymentMethodId: string;
  metadata: Record<string, string>;
}) {
  const secretKey = stripeSecret(input.businessId);
  if (!secretKey) return { ok: false as const, error: "Stripe is not connected, so the card was not charged." };
  if (!Number.isInteger(input.amountCents) || input.amountCents < 50) {
    return { ok: false as const, error: "Stripe can charge this order only when the total is at least $0.50." };
  }
  if (!/^pm_[A-Za-z0-9]+$/.test(input.paymentMethodId)) {
    return { ok: false as const, error: "The card was not charged." };
  }
  const fields: Record<string, string> = {
    amount: String(input.amountCents),
    currency: "usd",
    confirm: "true",
    payment_method: input.paymentMethodId,
    "payment_method_types[0]": "card",
    "expand[0]": "latest_charge",
  };
  for (const [key, value] of Object.entries(input.metadata)) {
    fields[`metadata[${key}]`] = value.slice(0, 500);
  }
  try {
    const intent = await stripeRequest(secretKey, "payment_intents", "POST", fields);
    if (intent.status === "succeeded") {
      const details = paymentDetails(intent);
      return {
        ok: true as const,
        status: "succeeded" as const,
        paymentIntentId: intent.id,
        last4: details.last4,
        wallet: details.wallet,
      };
    }
    if (intent.status === "requires_action" && intent.client_secret) {
      return {
        ok: true as const,
        status: "requires_action" as const,
        paymentIntentId: intent.id,
        clientSecret: intent.client_secret,
      };
    }
    return {
      ok: false as const,
      error: intent.last_payment_error?.message || "The card was not charged.",
    };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "The card was not charged." };
  }
}

export async function paidIntent(businessId: number, paymentIntentId: string) {
  const secretKey = stripeSecret(businessId);
  if (!secretKey) return { ok: false as const, error: "Stripe is not connected, so the card was not charged." };
  if (!/^pi_[A-Za-z0-9]+$/.test(paymentIntentId)) {
    return { ok: false as const, error: "That payment could not be confirmed." };
  }
  try {
    const intent = await stripeRequest(
      secretKey,
      `payment_intents/${paymentIntentId}?expand%5B%5D=latest_charge`,
      "GET",
    );
    if (intent.status !== "succeeded") {
      return { ok: false as const, error: intent.last_payment_error?.message || "The card was not charged." };
    }
    const details = paymentDetails(intent);
    return {
      ok: true as const,
      paymentIntentId: intent.id,
      amountCents: intent.amount,
      last4: details.last4,
      wallet: details.wallet,
      metadata: intent.metadata ?? {},
    };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "The card was not charged." };
  }
}

export function webhookSignatureMatches(payload: string, header: string, secret: string) {
  const pieces = header.split(",").map((part) => part.trim());
  const timestamp = pieces.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = pieces.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0 || !/^\d+$/.test(timestamp)) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const expectedBuffer = Buffer.from(expected);
  return signatures.some((signature) => {
    const actual = Buffer.from(signature);
    return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
  });
}

export function businessIdForWebhook(payload: string, header: string) {
  ensureStripeColumns();
  const rows = getDb()
    .prepare(
      `SELECT id, stripe_webhook_secret AS secret
       FROM businesses
       WHERE stripe_webhook_secret != ''`,
    )
    .all() as { id: number; secret: string }[];
  return rows.find((item) => webhookSignatureMatches(payload, header, item.secret))?.id ?? null;
}
