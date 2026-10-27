import Link from "next/link";
import { redirect } from "next/navigation";
import { PasswordResetForm } from "@/components/password-reset-form";
import { currentCustomer } from "@/lib/customer-auth";
import { getHomepageBusiness } from "@/lib/businesses";

export const metadata = { title: "Reset password" };

export default async function PasswordResetPage() {
  if (await currentCustomer()) redirect("/account");
  const business = getHomepageBusiness();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-white px-6 py-16 text-[#171a20]">
      <p className="text-sm text-[#5c5e62]">{business.name}</p>
      <h1 className="mt-2 text-4xl font-medium tracking-tight">Reset password</h1>
      <p className="mt-3 text-sm text-[#5c5e62]">
        Enter the phone number on your account. We text a code, then you set a new password.
      </p>
      <PasswordResetForm />
      <Link href="/account/login" className="mt-6 text-sm underline">
        Back to sign in
      </Link>
    </main>
  );
}
