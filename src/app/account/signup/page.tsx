import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountAuthForm } from "@/components/account-auth-form";
import { currentCustomer } from "@/lib/customer-auth";
import { getHomepageBusiness } from "@/lib/businesses";

export const metadata = { title: "Create account" };

export default async function CustomerSignupPage() {
  if (await currentCustomer()) redirect("/account");
  const business = getHomepageBusiness();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-white px-6 py-16 text-[#171a20]">
      <p className="text-sm text-[#5c5e62]">{business.name}</p>
      <h1 className="mt-2 text-4xl font-medium tracking-tight">Create account</h1>
      <p className="mt-3 text-sm text-[#5c5e62]">
        Your orders are matched to this phone number. Use the same number when you check out.
      </p>
      <AccountAuthForm mode="signup" />
      <Link href="/account/login" className="mt-6 text-sm underline">
        Already have an account
      </Link>
      <Link href="/" className="mt-3 text-sm text-[#5c5e62]">
        Back to the menu
      </Link>
    </main>
  );
}
