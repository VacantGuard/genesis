"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { saveAgentWebhook } from "@/lib/agent";
import { saveTextSettings } from "@/lib/messaging";
import { setSlackConnection } from "@/lib/businesses";
import { currentBusiness } from "@/lib/current-business";

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
    saveAgentWebhook(business.id, field(formData, "webhookUrl"));
  } catch (error) {
    bounce("/terminal/agent", error instanceof Error ? error.message : "Could not save the n8n webhook.");
  }
  revalidatePath("/terminal/agent");
  const connected = field(formData, "webhookUrl").length > 0;
  const message = connected
    ? "n8n will receive a trigger each time the menu changes."
    : "Menu updates will stay on this desk until an n8n webhook is saved.";
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
