"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireSession, setSessionCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { claimStaffInvite, createStaffInvite, listStaffAccounts } from "@/lib/staff-access";
import { clearCampaignHistory } from "@/lib/texts";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

export async function createStaffInviteAction() {
  await requireSession();
  const invite = createStaffInvite();
  redirect(`/terminal/access?invite=${encodeURIComponent(invite.token)}`);
}

export async function clearLaunchPracticeAction() {
  await requireSession();
  listStaffAccounts();
  const db = getDb();
  const orders = (db.prepare("SELECT COUNT(*) AS n FROM orders").get() as { n: number }).n;
  const campaigns = (db.prepare("SELECT COUNT(*) AS n FROM campaigns").get() as { n: number }).n;
  const staff = (db.prepare("SELECT username FROM staff_accounts").all() as { username: string }[]).map(
    (row) => row.username,
  );
  const clear = db.transaction(() => {
    db.exec("DELETE FROM order_items");
    db.exec("DELETE FROM orders");
    db.exec("DELETE FROM sms_log");
    db.exec("DELETE FROM campaigns");
    const inbound = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'inbound_texts'")
      .get();
    if (inbound) db.exec("DELETE FROM inbound_texts");
    db.prepare("DELETE FROM staff_accounts WHERE lower(username) = 'teeflex'").run();
    db.prepare("DELETE FROM staff_invites WHERE lower(username) = 'teeflex'").run();
  });
  clear();
  const left = (db.prepare("SELECT username FROM staff_accounts").all() as { username: string }[])
    .map((row) => row.username)
    .join(", ");
  redirect(
    `/terminal/access?saved=${encodeURIComponent(
      `Cleared ${orders} orders and ${campaigns} text campaigns. Removed teeflex. Staff now: ${left || "none"}. Was: ${staff.join(", ") || "none"}.`,
    )}`,
  );
}

export async function clearCampaignHistoryAction() {
  await requireSession();
  const removed = clearCampaignHistory();
  revalidatePath("/terminal/campaigns");
  revalidatePath("/terminal");
  redirect(
    `/terminal/access?saved=${encodeURIComponent(
      removed === 0 ? "Text history was already empty." : `Removed ${removed} past text campaigns.`,
    )}`,
  );
}

export async function claimStaffInviteAction(formData: FormData) {
  const token = field(formData, "token").trim();
  const back = `/terminal/join/${encodeURIComponent(token)}`;
  try {
    const username = claimStaffInvite({
      token,
      username: field(formData, "username"),
      password: field(formData, "password"),
      confirm: field(formData, "confirm"),
    });
    await setSessionCookie(username);
  } catch (error) {
    unstable_rethrow(error);
    const message = error instanceof Error ? error.message : "That account could not be created.";
    redirect(`${back}?error=${encodeURIComponent(message)}`);
  }
  redirect("/terminal?welcome=1");
}

export async function staffOrigin() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host") || "";
  const local = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const proto = headerStore.get("x-forwarded-proto") || (local ? "http" : "https");
  return host ? `${proto}://${host}` : "";
}
