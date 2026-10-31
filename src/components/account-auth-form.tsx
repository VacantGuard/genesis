"use client";

import { useActionState } from "react";
import { signInAction, signUpAction, type AccountFormState } from "@/lib/customer-actions";
import { publicButton, publicField } from "@/components/public-chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initial: AccountFormState = { error: "" };

export function AccountAuthForm({ mode }: { mode: "signup" | "login" }) {
  const [state, action, pending] = useActionState(mode === "signup" ? signUpAction : signInAction, initial);

  return (
    <form action={action} className="mt-8 grid gap-3">
      {mode === "signup" ? (
        <>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Name</span>
            <Input name="name" autoComplete="name" required className={publicField} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Phone</span>
            <Input name="phone" autoComplete="tel" required className={publicField} />
          </label>
        </>
      ) : null}
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Email</span>
        <Input name="email" type="email" autoComplete="email" required className={publicField} />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Password</span>
        <Input
          name="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          minLength={mode === "signup" ? 8 : undefined}
          className={publicField}
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className={`mt-2 ${publicButton}`}>
        {pending ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
      </Button>
    </form>
  );
}
