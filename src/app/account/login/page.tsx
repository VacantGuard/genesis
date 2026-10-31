import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountAuthForm } from "@/components/account-auth-form";
import { PublicFooter, PublicHeader, PublicPage } from "@/components/public-chrome";
import { currentCustomer } from "@/lib/customer-auth";

export const metadata = { title: "Sign in" };

export default async function CustomerLoginPage() {
  if (await currentCustomer()) redirect("/account");

  return (
    <PublicPage>
      <PublicHeader />
      <main className="mx-auto flex max-w-md flex-col px-6 py-14">
        <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">Sign in</h1>
        <p className="mt-3 text-sm text-[#5d7568]">Use the email and password for your meal account.</p>
        <AccountAuthForm mode="login" />
        <form action="/account/bypass" method="post" className="mt-8 border-t border-[#a8c09c]/60 pt-6">
          <p className="text-sm text-[#5d7568]">
            Temporary bypass. This opens the customer dashboard without a password.
          </p>
          <button type="submit" className="mt-3 text-sm font-medium text-[#fc968a] underline">
            Continue without signing in
          </button>
        </form>
        <Link href="/account/reset" className="mt-6 text-sm underline">
          Forgot password
        </Link>
        <Link href="/account/signup" className="mt-3 text-sm underline">
          Create an account
        </Link>
        <Link href="/" className="mt-3 text-sm text-[#5d7568]">
          Back to the menu
        </Link>
      </main>
      <PublicFooter />
    </PublicPage>
  );
}
