"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initial: LoginState = { error: "" };

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <form action={action} className="mt-8 grid gap-3">
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Username</span>
        <Input name="username" autoComplete="username" required className="h-10 bg-card" />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Password</span>
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-10 bg-card"
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="mt-2 h-10">
        {pending ? "Signing in…" : "Enter terminal"}
      </Button>
    </form>
  );
}
