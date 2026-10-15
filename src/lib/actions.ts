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
import {
  createCategory,
  createMenuItem,
  deleteCategory,
  deleteCompany,
  deleteCustomer,
  deleteMenuItem,
  OrderError,
  renameCategory,
  saveCompany,
  saveCustomer,
  sendCampaign,
  setMenuItemAvailability,
  updateMenuItem,
  updateProfile,
} from "@/lib/db";
import { parseDollarsToCents } from "@/lib/format";

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

function saved(path: string, message: string): never {
  revalidatePath("/");
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
  await requireSession();
  const name = field(formData, "name");
  const about = field(formData, "about");
  if (name.length < 2 || name.length > 80) {
    bounce("/terminal/profile", "The business name needs 2 to 80 characters.");
  }
  if (about.length < 10 || about.length > 4000) {
    bounce("/terminal/profile", "About copy needs between 10 and 4000 characters.");
  }
  updateProfile(name, about);
  saved("/terminal/profile", "Business profile saved. The public page will show it on the next load.");
}

export async function createCategoryAction(formData: FormData) {
  await requireSession();
  const name = field(formData, "name");
  if (name.length < 2 || name.length > 40) {
    bounce("/terminal/menu", "Category names need 2 to 40 characters.");
  }
  createCategory(name);
  saved("/terminal/menu", `Added the ${name} category.`);
}

export async function renameCategoryAction(formData: FormData) {
  await requireSession();
  const id = optionalId(field(formData, "id"));
  const name = field(formData, "name");
  if (!id) bounce("/terminal/menu", "That category could not be found.");
  if (name.length < 2 || name.length > 40) {
    bounce("/terminal/menu", "Category names need 2 to 40 characters.");
  }
  renameCategory(id, name);
  saved("/terminal/menu", "Category renamed.");
}

export async function deleteCategoryAction(formData: FormData) {
  await requireSession();
  const id = optionalId(field(formData, "id"));
  if (!id) bounce("/terminal/menu", "That category could not be found.");
  deleteCategory(id);
  saved("/terminal/menu", "Category and its meals were removed.");
}

function readItem(formData: FormData) {
  const categoryId = optionalId(field(formData, "categoryId"));
  const name = field(formData, "name");
  const description = field(formData, "description");
  const priceCents = parseDollarsToCents(field(formData, "price"));
  const available = checked(formData, "available");
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
  return { categoryId, name, description, priceCents, available };
}

export async function createMenuItemAction(formData: FormData) {
  await requireSession();
  const item = readItem(formData);
  createMenuItem(item);
  saved("/terminal/menu", `${item.name} is on the weekly menu.`);
}

export async function updateMenuItemAction(formData: FormData) {
  await requireSession();
  const id = optionalId(field(formData, "id"));
  if (!id) bounce("/terminal/menu", "That meal could not be found.");
  const item = readItem(formData);
  updateMenuItem({ id, ...item });
  saved("/terminal/menu", `${item.name} was updated on the public menu.`);
}

export async function setAvailabilityAction(formData: FormData) {
  await requireSession();
  const id = optionalId(field(formData, "id"));
  if (!id) bounce("/terminal/menu", "That meal could not be found.");
  const available = field(formData, "available") === "1";
  setMenuItemAvailability(id, available);
  saved(
    "/terminal/menu",
    available ? "Meal is available on the public menu." : "Meal is marked sold out.",
  );
}

export async function deleteMenuItemAction(formData: FormData) {
  await requireSession();
  const id = optionalId(field(formData, "id"));
  if (!id) bounce("/terminal/menu", "That meal could not be found.");
  deleteMenuItem(id);
  saved("/terminal/menu", "Meal removed from the menu.");
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
  await requireSession();
  const id = optionalId(field(formData, "id"));
  const company = readCompany(formData);
  saveCompany({ id, ...company });
  saved("/terminal/companies", id ? "Company updated." : "Company added.");
}

export async function deleteCompanyAction(formData: FormData) {
  await requireSession();
  const id = optionalId(field(formData, "id"));
  if (!id) bounce("/terminal/companies", "That company could not be found.");
  deleteCompany(id);
  saved("/terminal/companies", "Company removed. Linked customers are now unassigned.");
}

function readCustomer(formData: FormData) {
  const name = field(formData, "name");
  const phone = field(formData, "phone");
  const email = field(formData, "email");
  const notes = field(formData, "notes");
  const companyRaw = field(formData, "companyId");
  const companyId = companyRaw ? optionalId(companyRaw) ?? null : null;
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
  return { name, phone, email, companyId, notes };
}

export async function saveCustomerAction(formData: FormData) {
  await requireSession();
  const id = optionalId(field(formData, "id"));
  const customer = readCustomer(formData);
  saveCustomer({ id, ...customer });
  saved("/terminal/customers", id ? "Customer updated." : "Customer added.");
}

export async function deleteCustomerAction(formData: FormData) {
  await requireSession();
  const id = optionalId(field(formData, "id"));
  if (!id) bounce("/terminal/customers", "That customer could not be found.");
  deleteCustomer(id);
  saved("/terminal/customers", "Customer removed. Past orders stay on the list.");
}

export async function sendCampaignAction(input: {
  message: string;
  includeCustomers: boolean;
  includeCompanyContacts: boolean;
}): Promise<{ ok: true; recipientCount: number; linkUrl: string } | { ok: false; error: string }> {
  await requireSession();
  const message = input.message.trim();
  if (message.length < 2 || message.length > 480) {
    return { ok: false, error: "Write a message between 2 and 480 characters." };
  }
  if (!input.includeCustomers && !input.includeCompanyContacts) {
    return { ok: false, error: "Choose customers, company contacts, or both." };
  }

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host") || "localhost:43123";
  const proto = headerStore.get("x-forwarded-proto") || "http";
  const linkUrl = `${proto}://${host}/#pos`;

  try {
    const result = sendCampaign({
      message,
      linkUrl,
      includeCustomers: input.includeCustomers,
      includeCompanyContacts: input.includeCompanyContacts,
    });
    revalidatePath("/terminal/campaigns");
    return { ok: true, recipientCount: result.recipientCount, linkUrl: result.linkUrl };
  } catch (error) {
    if (error instanceof OrderError) return { ok: false, error: error.message };
    throw error;
  }
}
