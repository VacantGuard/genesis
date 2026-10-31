import Link from "next/link";
import { claimStaffInviteAction } from "@/lib/staff-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata = { title: "Create staff login" };

export default async function JoinStaffPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">Staff terminal</p>
      <h1 className="font-heading mt-2 text-4xl tracking-tight">Create your login</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Choose a username and password for the TigEats staff desk. This link works once.
      </p>
      <form action={claimStaffInviteAction} className="mt-8 grid gap-3">
        <input type="hidden" name="token" value={token} />
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Username</span>
          <Input name="username" autoComplete="username" required minLength={3} maxLength={32} className="h-10 bg-card" />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Password</span>
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="h-10 bg-card"
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Confirm password</span>
          <Input
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="h-10 bg-card"
          />
        </label>
        {query.error ? (
          <p role="alert" className="text-sm text-destructive">
            {query.error}
          </p>
        ) : null}
        <Button type="submit" className="mt-2 h-10">
          Create login and enter
        </Button>
      </form>
      <Link href="/terminal/login" className="mt-8 text-sm text-muted-foreground hover:text-foreground">
        Already have a login
      </Link>
    </main>
  );
}
