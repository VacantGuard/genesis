"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { saveAgentWebhook } from "@/lib/agent";
import { saveTextSettings } from "@/lib/messaging";
import { setPublicOrigin, setSlackConnection } from "@/lib/businesses";
import { currentBusiness } from "@/lib/current-business";
import { getMenuTextSchedule, parseClock, parseWeekday, saveMenuTextSchedule, scheduleReport } from "@/lib/menu-schedule";
import { saveStripeSettings } from "@/lib/stripe";
import { saveZelleAccount } from "@/lib/zelle";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function bounce(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function saveAgentWebhookAction(formData: FormData) {
  const business = await currentBusiness();
  await requireSession();
  try {
    setPublicOrigin(business.id, field(formData, "publicOrigin"));
    saveAgentWebhook(business.id, field(formData, "webhookUrl"));
  } catch (error) {
    bounce("/terminal/agent", error instanceof Error ? error.message : "Could not save agent settings.");
  }
  revalidatePath("/terminal/agent");
  const connected = field(formData, "webhookUrl").length > 0;
  const message = connected
    ? "Public site URL and n8n webhook saved. Menu texts keep using that public URL."
    : "Public site URL saved. Menu updates stay on this desk until an n8n webhook is saved.";
  redirect(`/terminal/agent?saved=${encodeURIComponent(message)}`);
}

export async function saveTextPlatformAction(formData: FormData) {
  const business = await currentBusiness();
  await requireSession();
  const platform = field(formData, "platform");
  try {
    saveTextSettings(business.id, {
      platform,
      accountId: field(formData, "accountId"),
      secret: field(formData, "secret"),
      fromNumber: field(formData, "fromNumber"),
    });
  } catch (error) {
    bounce("/terminal/campaigns", error instanceof Error ? error.message : "Could not save the text platform.");
  }
  revalidatePath("/terminal/campaigns");
  const message = platform
    ? "Text platform saved. Campaigns send through that account."
    : "Text platform disconnected. Campaigns stay in the log until you connect one again.";
  redirect(`/terminal/campaigns?saved=${encodeURIComponent(message)}`);
}

export async function saveStripeAction(formData: FormData) {
  const business = await currentBusiness();
  await requireSession();
  const disconnect = field(formData, "intent") === "disconnect";
  try {
    saveStripeSettings(business.id, {
      publishableKey: field(formData, "publishableKey"),
      secretKey: field(formData, "secretKey"),
      webhookSecret: field(formData, "webhookSecret"),
      disconnect,
    });
  } catch (error) {
    bounce("/terminal/profile", error instanceof Error ? error.message : "Could not save Stripe.");
  }
  revalidatePath("/terminal/profile");
  revalidatePath("/");
  revalidatePath(`/b/${business.slug}`);
  const message = disconnect
    ? "Stripe is disconnected. Customer checkout will not charge a card."
    : "Stripe is connected. Customer checkout can take Apple Pay and cards for this business.";
  redirect(`/terminal/profile?saved=${encodeURIComponent(message)}`);
}

export async function saveZelleAction(formData: FormData) {
  const business = await currentBusiness();
  await requireSession();
  try {
    saveZelleAccount(business.id, { name: field(formData, "name"), handle: field(formData, "handle") });
  } catch (error) {
    bounce("/terminal/profile", error instanceof Error ? error.message : "Could not save Zelle.");
  }
  revalidatePath("/terminal/profile");
  revalidatePath("/");
  revalidatePath(`/b/${business.slug}`);
  const handle = field(formData, "handle");
  redirect(
    `/terminal/profile?saved=${encodeURIComponent(
      handle ? "Zelle is on the public checkout." : "Zelle was removed from the public checkout.",
    )}`,
  );
}

export async function saveWeeklyMenuTextAction(formData: FormData) {
  const business = await currentBusiness();
  await requireSession();
  const current = getMenuTextSchedule(business.id);
  const weekday = parseWeekday(field(formData, "weekday"));
  const clock = parseClock(field(formData, "time"));
  if (weekday === null || !clock) {
    bounce("/terminal/campaigns", "Pick a send day and a send time.");
  }
  const turnOff = field(formData, "turnOff") === "off";
  let schedule;
  try {
    schedule = saveMenuTextSchedule(business.id, {
      enabled: turnOff ? false : true,
      weekday,
      hour: clock.hour,
      minute: clock.minute,
      timezone: current.timezone || "America/Chicago",
      message: field(formData, "message"),
    });
  } catch (error) {
    bounce("/terminal/campaigns", error instanceof Error ? error.message : "The weekly menu text could not be saved.");
  }
  revalidatePath("/terminal/campaigns");
  redirect(`/terminal/campaigns?saved=${encodeURIComponent(scheduleReport(schedule).summary)}`);
}

export async function saveSlackAction(formData: FormData) {
  const business = await currentBusiness();
  await requireSession();
  const teamId = field(formData, "teamId").toUpperCase();
  const teamName = field(formData, "teamName");
  if (teamId && !/^T[A-Z0-9]+$/.test(teamId)) {
    bounce("/terminal/slack", "A Slack workspace id starts with T, for example T0123ABCD.");
  }
  if (teamName.length > 80) {
    bounce("/terminal/slack", "Keep the workspace name under 80 characters.");
  }
  try {
    setSlackConnection(business.id, teamId || null, teamId ? teamName : "");
  } catch (error) {
    bounce("/terminal/slack", error instanceof Error ? error.message : "Could not save the Slack workspace.");
  }
  revalidatePath("/terminal/slack");
  const message = teamId
    ? `Slack workspace ${teamId} is connected to ${business.name}.`
    : `Slack is disconnected from ${business.name}.`;
  redirect(`/terminal/slack?saved=${encodeURIComponent(message)}`);
}
