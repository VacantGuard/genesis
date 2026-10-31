"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  clearSessionCookie,
  credentialsMatch,
  requireSession,
  setSessionCookie,
} from "@/lib/auth";
import { publishMenuUpdate } from "@/lib/agent";
import { menuLink, setMenuWeekNote, updateBusinessProfile, type BusinessRecord } from "@/lib/businesses";
import { currentBusiness } from "@/lib/current-business";
import {
  deleteCompany,
  deleteCustomer,
  saveCompany,
  saveCustomer,
} from "@/lib/directory";
import { OrderError } from "@/lib/db";
import { textStatusCallbackUrl } from "@/lib/messaging";
import { parseDollarsToCents } from "@/lib/format";
import {
  createCategory,
  createMenuItem,
  deleteCategory,
  deleteMenuItem,
  renameCategory,
  setMenuItemAvailability,
  updateMenuItem,
} from "@/lib/menu";
import { sendCampaign } from "@/lib/texts";

export type LoginState = { error: string };

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function checked(formData: FormData, key: string) {
  return formData.getAll(key).includes("1");
}

function bounce(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

async function deskBusiness() {
  await requireSession();
  return currentBusiness();
}
async function tellAgent(business: BusinessRecord, summary: string, staffMessage: string) {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host") || "127.0.0.1:43123";
  const proto = headerStore.get("x-forwarded-proto") || "http";
  const result = await publishMenuUpdate({ business, summary, origin: `${proto}://${host}` });
  const note = result.delivery === "sent"
    ? ` Slack can send ${result.menuUrl} to ${result.clientCount} clients.`
    : " Add the n8n webhook on the Agent page so Slack can send clients the link.";
  await saved("/terminal/menu", `${staffMessage}${note}`);
}

async function saved(path: string, message: string): Promise<never> {
  const business = await currentBusiness();
  revalidatePath("/");
  revalidatePath(`/b/${business.slug}`);
  revalidatePath(path);
  redirect(`${path}?saved=${encodeURIComponent(message)}`);
}

function optionalId(raw: string) {
  if (!raw) return undefined;
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) return undefined;
  return id;
}

export async function loginAction(_state: LoginState, formData: FormData): Promise<LoginState> {
  const username = field(formData, "username");
  const password = field(formData, "password");
  if (!credentialsMatch(username, password)) {
    return { error: "Those credentials do not match the staff login." };
  }
  await setSessionCookie(username);
  redirect("/terminal");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/terminal/login");
}

export async function saveProfileAction(formData: FormData) {
  const business = await deskBusiness();
  const name = field(formData, "name");
  const about = field(formData, "about");
  if (name.length < 2 || name.length > 80) {
    bounce("/terminal/profile", "The business name needs 2 to 80 characters.");
  }
  if (about.length < 10 || about.length > 4000) {
    bounce("/terminal/profile", "About copy needs between 10 and 4000 characters.");
  }
  updateBusinessProfile(business.id, name, about);
  await saved("/terminal/profile", "Business profile saved. The public page will show it on the next load.");
}

export async function createCategoryAction(formData: FormData) {
  const business = await deskBusiness();
  const name = field(formData, "name");
  if (name.length < 2 || name.length > 40) {
    bounce("/terminal/menu", "Category names need 2 to 40 characters.");
  }
  createCategory(business.id, name);
  await saved("/terminal/menu", `Added the ${name} category.`);
}

export async function renameCategoryAction(formData: FormData) {
  const business = await deskBusiness();
  const id = optionalId(field(formData, "id"));
  const name = field(formData, "name");
  if (!id) bounce("/terminal/menu", "That category could not be found.");
  if (name.length < 2 || name.length > 40) {
    bounce("/terminal/menu", "Category names need 2 to 40 characters.");
  }
  renameCategory(business.id, id, name);
  await tellAgent(business, `${name} is the new category name.`, "Category renamed.");
}

export async function deleteCategoryAction(formData: FormData) {
  const business = await deskBusiness();
  const id = optionalId(field(formData, "id"));
  if (!id) bounce("/terminal/menu", "That category could not be found.");
  deleteCategory(business.id, id);
  await tellAgent(business, "A menu category and its meals were removed.", "Category and its meals were removed.");
}

function wholeNumber(formData: FormData, key: string, label: string, max: number) {
  const raw = field(formData, key);
  if (!raw) return null;
  if (!/^\d+$/.test(raw) || Number(raw) > max) {
    bounce("/terminal/menu", `${label} needs a whole number up to ${max}.`);
  }
  return Number(raw);
}

function readItem(formData: FormData) {
  const categoryId = optionalId(field(formData, "categoryId"));
  const name = field(formData, "name");
  const description = field(formData, "description");
  const priceCents = parseDollarsToCents(field(formData, "price"));
  const available = checked(formData, "available");
  const calories = wholeNumber(formData, "calories", "Calories", 9999);
  const protein = wholeNumber(formData, "protein", "Protein", 999);
  if (!categoryId) bounce("/terminal/menu", "Choose a category.");
  if (name.length < 2 || name.length > 80) {
    bounce("/terminal/menu", "Meal names need 2 to 80 characters.");
  }
  if (description.length > 400) {
    bounce("/terminal/menu", "Keep the description under 400 characters.");
  }
  if (priceCents === null) {
    bounce("/terminal/menu", "Enter a price in dollars, such as 14 or 14.50.");
  }
  return { categoryId, name, description, priceCents, available, calories, protein };
}

export async function saveMenuWeekAction(formData: FormData) {
  const business = await deskBusiness();
  const weekOf = field(formData, "weekOf");
  if (weekOf.length > 80) {
    bounce("/terminal/menu", "Keep the week line under 80 characters.");
  }
  setMenuWeekNote(business.id, weekOf);
  await saved(
    "/terminal/menu",
    weekOf ? "Week line saved on the public menu." : "Week line cleared on the public menu.",
  );
}

export async function createMenuItemAction(formData: FormData) {
  const business = await deskBusiness();
  const item = readItem(formData);
  const savedItem = createMenuItem({ businessId: business.id, ...item });
  if (!savedItem) bounce("/terminal/menu", "That category is not on this business.");
  await tellAgent(business, `${item.name} is on the weekly menu.`, `${item.name} is on the weekly menu.`);
}

export async function updateMenuItemAction(formData: FormData) {
  const business = await deskBusiness();
  const id = optionalId(field(formData, "id"));
  if (!id) bounce("/terminal/menu", "That meal could not be found.");
  const item = readItem(formData);
  const updated = updateMenuItem({ businessId: business.id, id, ...item });
  if (!updated) bounce("/terminal/menu", "That meal is not on this business.");
  await tellAgent(business, `${item.name} was updated on the weekly menu.`, `${item.name} was updated on the public menu.`);
}

export async function setAvailabilityAction(formData: FormData) {
  const business = await deskBusiness();
  const id = optionalId(field(formData, "id"));
  if (!id) bounce("/terminal/menu", "That meal could not be found.");
  const available = field(formData, "available") === "1";
  const updated = setMenuItemAvailability(business.id, id, available);
  if (!updated) bounce("/terminal/menu", "That meal is not on this business.");
  await tellAgent(
    business,
    available ? "A meal is available again." : "A meal is sold out.",
    available ? "Meal is available on the public menu." : "Meal is marked sold out.",
  );
}

export async function deleteMenuItemAction(formData: FormData) {
  const business = await deskBusiness();
  const id = optionalId(field(formData, "id"));
  if (!id) bounce("/terminal/menu", "That meal could not be found.");
  const removed = deleteMenuItem(business.id, id);
  if (!removed) bounce("/terminal/menu", "That meal is not on this business.");
  await tellAgent(business, "A meal was removed from the weekly menu.", "Meal removed from the menu.");
}

function readCompany(formData: FormData) {
  const name = field(formData, "name");
  const contactName = field(formData, "contactName");
  const phone = field(formData, "phone");
  const email = field(formData, "email");
  const notes = field(formData, "notes");
  if (name.length < 2 || name.length > 80) {
    bounce("/terminal/companies", "Company names need 2 to 80 characters.");
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    bounce("/terminal/companies", "That email does not look right.");
  }
  return { name, contactName, phone, email, notes };
}

export async function saveCompanyAction(formData: FormData) {
  const business = await deskBusiness();
  const id = optionalId(field(formData, "id"));
  const company = readCompany(formData);
  saveCompany({ businessId: business.id, id, ...company });
  await saved("/terminal/companies", id ? "Company updated." : "Company added.");
}

export async function deleteCompanyAction(formData: FormData) {
  const business = await deskBusiness();
  const id = optionalId(field(formData, "id"));
  if (!id) bounce("/terminal/companies", "That company could not be found.");
  deleteCompany(business.id, id);
  await saved("/terminal/companies", "Company removed. Linked customers are now unassigned.");
}

function readCustomer(formData: FormData) {
  const name = field(formData, "name");
  const phone = field(formData, "phone");
  const email = field(formData, "email");
  const notes = field(formData, "notes");
  const companyRaw = field(formData, "companyId");
  const companyId = companyRaw ? optionalId(companyRaw) ?? null : null;
  const delivery = {
    line1: field(formData, "deliveryLine1"),
    line2: field(formData, "deliveryLine2"),
    city: field(formData, "deliveryCity"),
    state: field(formData, "deliveryState").toUpperCase(),
    postalCode: field(formData, "deliveryPostalCode"),
  };
  if (companyRaw && !companyId) {
    bounce("/terminal/customers", "Choose a valid company.");
  }
  if (name.length < 2 || name.length > 80) {
    bounce("/terminal/customers", "Customer names need 2 to 80 characters.");
  }
  if (!phone && !email) {
    bounce("/terminal/customers", "Add a phone number or an email.");
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    bounce("/terminal/customers", "That email does not look right.");
  }
  if (!delivery.line1 || delivery.line1.length < 3) {
    bounce("/terminal/customers", "Enter a delivery street address.");
  }
  if (!delivery.city || delivery.city.length < 2) {
    bounce("/terminal/customers", "Enter the delivery city.");
  }
  if (!delivery.state || delivery.state.length < 2) {
    bounce("/terminal/customers", "Enter the delivery state.");
  }
  if (!delivery.postalCode || delivery.postalCode.length < 3) {
    bounce("/terminal/customers", "Enter the delivery ZIP or postal code.");
  }
  return { name, phone, email, companyId, notes, delivery };
}

export async function saveCustomerAction(formData: FormData) {
  const business = await deskBusiness();
  const id = optionalId(field(formData, "id"));
  const customer = readCustomer(formData);
  const savedCustomer = saveCustomer({ businessId: business.id, id, ...customer });
  if (!savedCustomer) bounce("/terminal/customers", "That company is not on this business.");
  await saved("/terminal/customers", id ? "Customer updated." : "Customer added.");
}

export async function deleteCustomerAction(formData: FormData) {
  const business = await deskBusiness();
  const id = optionalId(field(formData, "id"));
  if (!id) bounce("/terminal/customers", "That customer could not be found.");
  deleteCustomer(business.id, id);
  await saved("/terminal/customers", "Customer removed. Past orders stay on the list.");
}

export async function sendCampaignAction(input: {
  message: string;
  includeCustomers: boolean;
  includeCompanyContacts: boolean;
}): Promise<
  | { ok: true; recipientCount: number; sentCount: number; failedCount: number; linkUrl: string; mode: "sent" | "logged" }
  | { ok: false; error: string }
> {
  const business = await deskBusiness();
  const message = input.message.trim();
  if (message.length < 2 || message.length > 480) {
    return { ok: false, error: "Write a message between 2 and 480 characters." };
  }
  if (!input.includeCustomers && !input.includeCompanyContacts) {
    return { ok: false, error: "Choose customers, company contacts, or both." };
  }

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host") || "127.0.0.1:43123";
  const proto = headerStore.get("x-forwarded-proto") || "http";
  const linkUrl = menuLink(business.slug, `${proto}://${host}`);

  try {
    const result = await sendCampaign({
      businessId: business.id,
      message,
      linkUrl,
      includeCustomers: input.includeCustomers,
      includeCompanyContacts: input.includeCompanyContacts,
      statusCallbackUrl: textStatusCallbackUrl(`${proto}://${host}`),
    });
    revalidatePath("/terminal/campaigns");
    return {
      ok: true,
      recipientCount: result.recipientCount,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      linkUrl: result.linkUrl,
      mode: result.mode,
    };
  } catch (error) {
    if (error instanceof OrderError) return { ok: false, error: error.message };
    throw error;
  }
}
