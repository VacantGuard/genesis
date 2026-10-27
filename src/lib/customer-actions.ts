"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clearCustomerSession, signInCustomer, signUpCustomer } from "./customer-auth";
import { requestPasswordReset, resetCustomerPassword } from "./customer-reset";

export type AccountFormState = { error: string };

export type ResetRequestState = { error: string; phone: string; logged: boolean };

async function requestOrigin() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host") || "";
  const local = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const proto = headerStore.get("x-forwarded-proto") || (local ? "http" : "https");
  return host ? `${proto}://${host}` : "";
}

export async function signUpAction(_state: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const result = await signUpCustomer({
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!result.ok) return { error: result.error };
  redirect("/account");
}

export async function signInAction(_state: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const result = await signInCustomer({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!result.ok) return { error: result.error };
  redirect("/account");
}

export async function signOutAction() {
  await clearCustomerSession();
  redirect("/account/login");
}

export async function requestResetAction(_state: ResetRequestState, formData: FormData): Promise<ResetRequestState> {
  const result = await requestPasswordReset({
    phone: String(formData.get("phone") ?? ""),
    linkUrl: `${await requestOrigin()}/account/reset`,
  });
  if (!result.ok) return { error: result.error, phone: "", logged: false };
  return { error: "", phone: result.phone, logged: result.logged };
}

export async function confirmResetAction(_state: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password !== confirm) return { error: "Those passwords do not match." };
  const result = await resetCustomerPassword({
    phone: String(formData.get("phone") ?? ""),
    code: String(formData.get("code") ?? ""),
    password,
  });
  if (!result.ok) return { error: result.error };
  redirect("/account");
}
