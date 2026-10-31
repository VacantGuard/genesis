import Link from "next/link";
import { LoginForm } from "@/components/terminal/login-form";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Staff login" };

export default async function LoginPage() {
  if (await getSession()) redirect("/terminal");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">Staff terminal</p>
      <h1 className="font-heading mt-2 text-4xl tracking-tight">Sign in</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Sign in with the kitchen login, or with a username created from a staff invite.
      </p>
      <LoginForm />
      <Link href="/" className="mt-8 text-sm text-muted-foreground hover:text-foreground">
        Back to the public menu
      </Link>
    </main>
  );
}
