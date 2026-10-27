import Link from "next/link";
import { redirect } from "next/navigation";
import { PasswordResetForm } from "@/components/password-reset-form";
import { currentCustomer } from "@/lib/customer-auth";
import { resetTokenValid } from "@/lib/customer-reset";
import { getHomepageBusiness } from "@/lib/businesses";

export const metadata = { title: "Reset password" };

export default async function PasswordResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token && (await currentCustomer())) redirect("/account");
  const business = getHomepageBusiness();
  const linkOk = token ? resetTokenValid(token) : false;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-white px-6 py-16 text-[#171a20]">
      <p className="text-sm text-[#5c5e62]">{business.name}</p>
      <h1 className="mt-2 text-4xl font-medium tracking-tight">Reset password</h1>
      {token ? (
        linkOk ? (
          <>
            <p className="mt-3 text-sm text-[#5c5e62]">Choose a new password. This link works once.</p>
            <PasswordResetForm token={token} />
          </>
        ) : (
          <p role="alert" className="mt-3 text-sm text-destructive">
            That reset link is invalid or has expired. Request a new one.
          </p>
        )
      ) : (
        <>
          <p className="mt-3 text-sm text-[#5c5e62]">
            Enter the phone number on your account. We email a reset link to the address on that account.
          </p>
          <PasswordResetForm />
        </>
      )}
      {token ? (
        <Link href="/account/reset" className="mt-6 text-sm underline">
          Request a new link
        </Link>
      ) : null}
      <Link href="/account/login" className="mt-6 text-sm underline">
        Back to sign in
      </Link>
    </main>
  );
}
