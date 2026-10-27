import { randomInt } from "node:crypto";
import { getHomepageBusiness, rememberedOrigin } from "./businesses";
import { checkPassword, ensureAccounts, hashPassword, writeCookie } from "./customer-auth";
import { getDb } from "./db";
import { deliverText } from "./texts";

const RESET_MINUTES = 15;

function digits(phone: string) {
  return phone.replace(/\D/g, "");
}

function accountForPhone(businessId: number, phone: string) {
  const key = digits(phone);
  const rows = getDb()
    .prepare(
      `SELECT a.id, c.name, c.phone
       FROM customer_accounts a
       JOIN customers c ON c.id = a.customer_id
       WHERE a.business_id = ?
       ORDER BY a.id DESC`,
    )
    .all(businessId) as { id: number; name: string; phone: string }[];
  return rows.find((row) => digits(row.phone) === key) ?? null;
}

export async function requestPasswordReset(input: { phone: string; linkUrl: string }) {
  ensureAccounts();
  const phone = input.phone.trim();
  if (digits(phone).length < 7) return { ok: false as const, error: "Enter the phone number on the account." };
  const business = getHomepageBusiness();
  const account = accountForPhone(business.id, phone);
  if (!account) return { ok: false as const, error: "No account uses that phone number." };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expires = new Date(Date.now() + RESET_MINUTES * 60 * 1000).toISOString();
  getDb()
    .prepare("UPDATE customer_accounts SET reset_code_hash = ?, reset_expires_at = ? WHERE id = ?")
    .run(hashPassword(code), expires, account.id);

  const origin = rememberedOrigin(business.id);
  const linkUrl = origin ? `${origin}/account/reset` : input.linkUrl;
  const body = `${business.name}: Your password reset code is ${code}. It expires in ${RESET_MINUTES} minutes. Set a new password at ${linkUrl}`;
  const sent = await deliverText({
    businessId: business.id,
    name: account.name,
    phone: account.phone,
    body,
    linkUrl,
  });
  if (!sent.ok) {
    getDb()
      .prepare("UPDATE customer_accounts SET reset_code_hash = '', reset_expires_at = '' WHERE id = ?")
      .run(account.id);
    return { ok: false as const, error: `The reset text could not be sent. ${sent.detail}` };
  }
  return { ok: true as const, phone: account.phone, logged: sent.mode === "logged" };
}

export async function resetCustomerPassword(input: { phone: string; code: string; password: string }) {
  ensureAccounts();
  const code = input.code.trim();
  if (!/^\d{6}$/.test(code)) return { ok: false as const, error: "Enter the 6-digit code from the text." };
  if (input.password.length < 8) return { ok: false as const, error: "Use a password of at least 8 characters." };
  const business = getHomepageBusiness();
  const account = accountForPhone(business.id, input.phone);
  if (!account) return { ok: false as const, error: "No account uses that phone number." };
  const row = getDb()
    .prepare("SELECT reset_code_hash AS hash, reset_expires_at AS expires FROM customer_accounts WHERE id = ?")
    .get(account.id) as { hash: string; expires: string };
  if (!row.hash || !row.expires || new Date(row.expires).getTime() < Date.now()) {
    return { ok: false as const, error: "That code has expired. Request a new one." };
  }
  if (!checkPassword(code, row.hash)) return { ok: false as const, error: "That code does not match." };
  getDb()
    .prepare(
      "UPDATE customer_accounts SET password_hash = ?, reset_code_hash = '', reset_expires_at = '' WHERE id = ?",
    )
    .run(hashPassword(input.password), account.id);
  await writeCookie(account.id);
  return { ok: true as const };
}
