"use client";

import { useActionState } from "react";
import { confirmResetAction, requestResetAction, type ResetRequestState } from "@/lib/customer-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const requestInitial: ResetRequestState = { error: "", phone: "", logged: false };
const confirmInitial = { error: "" };
const field = "h-10 rounded border-0 bg-[#f4f4f4] shadow-none";

export function PasswordResetForm() {
  const [requestState, requestAction, requestPending] = useActionState(requestResetAction, requestInitial);
  const [confirmState, confirmAction, confirmPending] = useActionState(confirmResetAction, confirmInitial);
  const ready = Boolean(requestState.phone);

  return (
    <div className="mt-8 grid gap-8">
      <form action={requestAction} className="grid gap-3">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Phone</span>
          <Input name="phone" autoComplete="tel" required defaultValue={requestState.phone} className={field} />
        </label>
        {requestState.error ? (
          <p role="alert" className="text-sm text-destructive">
            {requestState.error}
          </p>
        ) : null}
        <Button type="submit" disabled={requestPending} className="h-10 rounded bg-[#171a20] text-white hover:bg-black">
          {requestPending ? "Sending…" : "Text me a code"}
        </Button>
      </form>

      {ready ? (
        <form action={confirmAction} className="grid gap-3 border-t border-black/10 pt-6">
          <p className="text-sm text-[#5c5e62]">
            {requestState.logged
              ? "Texts are not connected, so the reset was logged the same way an unsent menu text is logged. Enter that code to set a new password."
              : `We texted a code to ${requestState.phone}. Enter it to set a new password.`}
          </p>
          <input type="hidden" name="phone" value={requestState.phone} />
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Code</span>
            <Input name="code" inputMode="numeric" autoComplete="one-time-code" required className={field} />
          </label>
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
      ) : null}
    </div>
  );
}
