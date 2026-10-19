import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountAuthForm } from "@/components/account-auth-form";
import { currentCustomer } from "@/lib/customer-auth";
import { getHomepageBusiness } from "@/lib/businesses";

export const metadata = { title: "Sign in" };

export default async function CustomerLoginPage() {
  if (await currentCustomer()) redirect("/account");
  const business = getHomepageBusiness();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-white px-6 py-16 text-[#171a20]">
      <p className="text-sm text-[#5c5e62]">{business.name}</p>
      <h1 className="mt-2 text-4xl font-medium tracking-tight">Sign in</h1>
      <p className="mt-3 text-sm text-[#5c5e62]">Use the email and password for your meal account.</p>
      <AccountAuthForm mode="login" />
      <form action="/account/bypass" method="post" className="mt-8 border-t border-black/10 pt-6">
        <p className="text-sm text-[#5c5e62]">
          Temporary bypass. This opens the customer dashboard without a password.
        </p>
        <button type="submit" className="mt-3 text-sm font-medium underline">
          Continue without signing in
        </button>
      </form>
      <Link href="/account/signup" className="mt-6 text-sm underline">
        Create an account
      </Link>
      <Link href="/" className="mt-3 text-sm text-[#5c5e62]">
        Back to the menu
      </Link>
    </main>
  );
}
