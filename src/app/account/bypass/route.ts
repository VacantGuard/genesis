import { redirect } from "next/navigation";
import { startCustomerBypass } from "@/lib/customer-auth";

export async function POST() {
  await startCustomerBypass();
  redirect("/account");
}
