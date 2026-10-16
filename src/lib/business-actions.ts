"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import {
  createBusiness,
  getBusiness,
  setSlackConnection,
  slugify,
} from "@/lib/businesses";
import { currentBusiness, rememberBusiness } from "@/lib/current-business";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function bounce(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function selectBusinessAction(formData: FormData) {
  await requireSession();
  const id = Number(field(formData, "businessId"));
  const business = Number.isInteger(id) ? getBusiness(id) : null;
  if (!business) bounce("/terminal", "That business is not on this desk.");
  await rememberBusiness(business.id);
  revalidatePath("/terminal");
  redirect("/terminal");
}

export async function createBusinessAction(formData: FormData) {
  await requireSession();
  const name = field(formData, "name");
  const about = field(formData, "about");
  if (name.length < 2 || name.length > 80) {
    bounce("/terminal/profile", "The business name needs 2 to 80 characters.");
  }
  if (slugify(name) === "business" && !/[a-z0-9]/i.test(name)) {
    bounce("/terminal/profile", "Use a name that can become a public link.");
  }
  if (about.length < 10 || about.length > 4000) {
    bounce("/terminal/profile", "About copy needs between 10 and 4000 characters.");
  }
  const business = createBusiness(name, about);
  await rememberBusiness(business.id);
  revalidatePath("/");
  revalidatePath(`/b/${business.slug}`);
  redirect("/terminal/profile?saved=" + encodeURIComponent(`${business.name} is the business open on this desk.`));
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
