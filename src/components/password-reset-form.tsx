"use client";

import { useActionState } from "react";
import { confirmResetAction, requestResetAction, type ResetRequestState } from "@/lib/customer-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const requestInitial: ResetRequestState = { error: "", sent: false, logged: false };
const confirmInitial = { error: "" };
const field = "h-10 rounded border-0 bg-[#f4f4f4] shadow-none";

export function PasswordResetForm({ token }: { token?: string }) {
  const [requestState, requestAction, requestPending] = useActionState(requestResetAction, requestInitial);
  const [confirmState, confirmAction, confirmPending] = useActionState(confirmResetAction, confirmInitial);

  if (token) {
    return (
      <form action={confirmAction} className="mt-8 grid gap-3">
        <input type="hidden" name="token" value={token} />
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">New password</span>
          <Input name="password" type="password" autoComplete="new-password" required minLength={8} className={field} />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Confirm password</span>
          <Input name="confirm" type="password" autoComplete="new-password" required minLength={8} className={field} />
        </label>
        {confirmState.error ? (
          <p role="alert" className="text-sm text-destructive">
            {confirmState.error}
          </p>
        ) : null}
        <Button type="submit" disabled={confirmPending} className="h-10 rounded bg-[#171a20] text-white hover:bg-black">
          {confirmPending ? "Saving…" : "Set new password"}
        </Button>
      </form>
    );
  }

  return (
    <form action={requestAction} className="mt-8 grid gap-3">
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Phone</span>
        <Input name="phone" autoComplete="tel" required className={field} />
      </label>
      {requestState.error ? (
        <p role="alert" className="text-sm text-destructive">
          {requestState.error}
        </p>
      ) : null}
      {requestState.sent ? (
        <p className="text-sm text-[#5c5e62]">
          {requestState.logged
            ? "Email is not connected on this machine, so the reset link was saved here instead of sent."
            : "We emailed a reset link to the email on that account."}
        </p>
      ) : null}
      <Button type="submit" disabled={requestPending} className="h-10 rounded bg-[#171a20] text-white hover:bg-black">
        {requestPending ? "Sending…" : "Email me a reset link"}
      </Button>
    </form>
  );
}
