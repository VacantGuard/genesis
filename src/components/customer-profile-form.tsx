"use client";

import { useActionState } from "react";
import { publicButton, publicField } from "@/components/public-chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateProfileAction, type AccountFormState } from "@/lib/customer-actions";
import type { CheckoutDetails } from "@/lib/customer-auth";

const initial: AccountFormState = { error: "" };

export function CustomerProfileForm({ profile }: { profile: CheckoutDetails }) {
  const [state, action, pending] = useActionState(updateProfileAction, initial);

  return (
    <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1.5 text-sm sm:col-span-2">
        <span className="font-medium">Name</span>
        <Input name="name" defaultValue={profile.name} autoComplete="name" required className={publicField} />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Phone</span>
        <Input name="phone" defaultValue={profile.phone} autoComplete="tel" required className={publicField} />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Email</span>
        <Input
          name="email"
          type="email"
          defaultValue={profile.email}
          autoComplete="email"
          required
          className={publicField}
        />
      </label>
      <label className="grid gap-1.5 text-sm sm:col-span-2">
        <span className="font-medium">Company</span>
        <Input
          name="companyName"
          defaultValue={profile.companyName}
          autoComplete="organization"
          placeholder="Optional"
          className={publicField}
        />
      </label>
      <label className="grid gap-1.5 text-sm sm:col-span-2">
        <span className="font-medium">Delivery street</span>
        <Input
          name="line1"
          defaultValue={profile.line1}
          autoComplete="address-line1"
          className={publicField}
        />
      </label>
      <label className="grid gap-1.5 text-sm sm:col-span-2">
        <span className="font-medium">Apt / suite</span>
        <Input
          name="line2"
          defaultValue={profile.line2}
          autoComplete="address-line2"
          placeholder="Optional"
          className={publicField}
        />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">City</span>
        <Input name="city" defaultValue={profile.city} autoComplete="address-level2" className={publicField} />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">State</span>
        <Input name="state" defaultValue={profile.state} autoComplete="address-level1" className={publicField} />
      </label>
      <label className="grid gap-1.5 text-sm sm:col-span-2">
        <span className="font-medium">ZIP</span>
        <Input
          name="postalCode"
          defaultValue={profile.postalCode}
          autoComplete="postal-code"
          className={publicField}
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive sm:col-span-2">
          {state.error}
        </p>
      ) : null}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending} className={publicButton}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
