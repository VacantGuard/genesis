import Link from "next/link";
import { redirect } from "next/navigation";
import { PasswordResetForm } from "@/components/password-reset-form";
import { PublicFooter, PublicHeader, PublicPage } from "@/components/public-chrome";
import { currentCustomer } from "@/lib/customer-auth";
import { resetTokenValid } from "@/lib/customer-reset";

export const metadata = { title: "Reset password" };

export default async function PasswordResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token && (await currentCustomer())) redirect("/account");
  const linkOk = token ? resetTokenValid(token) : false;

  return (
    <PublicPage>
      <PublicHeader />
      <main className="mx-auto flex max-w-md flex-col px-6 py-14">
      <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">Reset password</h1>
      {token ? (
        linkOk ? (
          <>
            <p className="mt-3 text-sm text-[#5d7568]">Choose a new password. This link works once.</p>
            <PasswordResetForm token={token} />
          </>
        ) : (
          <p role="alert" className="mt-3 text-sm text-destructive">
            That reset link is invalid or has expired. Request a new one.
          </p>
        )
      ) : (
        <>
          <p className="mt-3 text-sm leading-6 text-[#5d7568]">
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
      <PublicFooter />
    </PublicPage>
  );
}
