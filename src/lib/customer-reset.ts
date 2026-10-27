import { createHash, randomBytes } from "node:crypto";
import { getHomepageBusiness, rememberedOrigin } from "./businesses";
import { ensureAccounts, hashPassword, writeCookie } from "./customer-auth";
import { getDb } from "./db";
import { sendAccountEmail } from "./mail";

const RESET_MINUTES = 60;

function digits(phone: string) {
  return phone.replace(/\D/g, "");
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function accountForPhone(businessId: number, phone: string) {
  const key = digits(phone);
  const rows = getDb()
    .prepare(
      `SELECT a.id, a.email, c.phone
       FROM customer_accounts a
       JOIN customers c ON c.id = a.customer_id
       WHERE a.business_id = ?
       ORDER BY a.id DESC`,
    )
    .all(businessId) as { id: number; email: string; phone: string }[];
  return rows.find((row) => digits(row.phone) === key) ?? null;
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function resetLink(requestUrl: string, businessId: number, token: string) {
  const requested = requestUrl.replace(/\/account\/reset.*$/, "").replace(/\/+$/, "");
  let host = "";
  try {
    host = new URL(requested).hostname;
  } catch {
    host = "";
  }
  const local = host === "localhost" || host === "127.0.0.1";
  const origin = (local ? requested : rememberedOrigin(businessId) || requested).replace(/\/+$/, "");
  return `${origin}/account/reset?token=${encodeURIComponent(token)}`;
}

export async function requestPasswordReset(input: { phone: string; linkUrl: string }) {
  ensureAccounts();
  const phone = input.phone.trim();
  if (digits(phone).length < 7) return { ok: false as const, error: "Enter the phone number on the account." };
  const business = getHomepageBusiness();
  const account = accountForPhone(business.id, phone);
  if (!account) return { ok: false as const, error: "No account uses that phone number." };
  const email = account.email.trim().toLowerCase();
  if (!validEmail(email)) {
    return { ok: false as const, error: "That account has no email address, so no reset link was sent." };
  }

  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + RESET_MINUTES * 60 * 1000).toISOString();
  getDb()
    .prepare("UPDATE customer_accounts SET reset_code_hash = ?, reset_expires_at = ? WHERE id = ?")
    .run(tokenHash(token), expires, account.id);

  const link = resetLink(input.linkUrl, business.id, token);
  const sent = await sendAccountEmail({
    to: email,
    subject: `Reset your ${business.name} password`,
    text: `Set a new password for your ${business.name} account:\n${link}\n\nThis link expires in ${RESET_MINUTES} minutes. If you did not ask for this, you can ignore this email.`,
  });
  if (!sent.ok) {
    getDb()
      .prepare("UPDATE customer_accounts SET reset_code_hash = '', reset_expires_at = '' WHERE id = ?")
      .run(account.id);
    return { ok: false as const, error: sent.error };
  }
  return { ok: true as const, logged: sent.mode === "logged" };
}

function accountForToken(token: string) {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const business = getHomepageBusiness();
  const row = getDb()
    .prepare(
      `SELECT id, reset_expires_at AS expires
       FROM customer_accounts
       WHERE business_id = ? AND reset_code_hash = ?`,
    )
    .get(business.id, tokenHash(trimmed)) as { id: number; expires: string } | undefined;
  if (!row?.expires || new Date(row.expires).getTime() < Date.now()) return null;
  return row;
}

export function resetTokenValid(token: string) {
  ensureAccounts();
  return Boolean(accountForToken(token));
}

export async function resetCustomerPassword(input: { token: string; password: string }) {
  ensureAccounts();
  if (input.password.length < 8) return { ok: false as const, error: "Use a password of at least 8 characters." };
  const account = accountForToken(input.token);
  if (!account) return { ok: false as const, error: "That reset link is invalid or has expired. Request a new one." };
  getDb()
    .prepare("UPDATE customer_accounts SET password_hash = ?, reset_code_hash = '', reset_expires_at = '' WHERE id = ?")
    .run(hashPassword(input.password), account.id);
  await writeCookie(account.id);
  return { ok: true as const };
}
