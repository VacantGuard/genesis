import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountAuthForm } from "@/components/account-auth-form";
import { PublicFooter, PublicHeader, PublicPage } from "@/components/public-chrome";
import { currentCustomer } from "@/lib/customer-auth";

export const metadata = { title: "Create account" };

export default async function CustomerSignupPage() {
  if (await currentCustomer()) redirect("/account");

  return (
    <PublicPage>
      <PublicHeader />
      <main className="mx-auto flex max-w-md flex-col px-6 py-14">
        <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">Create account</h1>
        <p className="mt-3 text-sm leading-6 text-[#5d7568]">
          Your orders are matched to this phone number. Use the same number when you check out.
        </p>
        <AccountAuthForm mode="signup" />
        <Link href="/account/login" className="mt-6 text-sm underline">
          Already have an account
        </Link>
        <Link href="/" className="mt-3 text-sm text-[#5d7568]">
          Back to the menu
        </Link>
      </main>
      <PublicFooter />
    </PublicPage>
  );
}
