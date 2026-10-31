"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireSession, setSessionCookie } from "@/lib/auth";
import { claimStaffInvite, createStaffInvite } from "@/lib/staff-access";
import { clearCampaignHistory } from "@/lib/texts";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

export async function createStaffInviteAction() {
  await requireSession();
  const invite = createStaffInvite();
  redirect(`/terminal/access?invite=${encodeURIComponent(invite.token)}`);
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
  redirect("/terminal");
}

export async function staffOrigin() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host") || "";
  const local = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const proto = headerStore.get("x-forwarded-proto") || (local ? "http" : "https");
  return host ? `${proto}://${host}` : "";
}
