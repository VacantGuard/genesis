"use server";

import { redirect } from "next/navigation";
import { clearCustomerSession, signInCustomer, signUpCustomer } from "./customer-auth";

export type AccountFormState = { error: string };

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
