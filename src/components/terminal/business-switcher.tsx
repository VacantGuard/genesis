"use client";

import { selectBusinessAction } from "@/lib/business-actions";

export function BusinessSwitcher({
  businesses,
  currentId,
}: {
  businesses: { id: number; name: string }[];
  currentId: number;
}) {
  return (
    <form action={selectBusinessAction} className="flex items-center gap-2">
      <label className="text-xs text-muted-foreground">
        <span className="sr-only">Business open on this desk</span>
        <select
          name="businessId"
          defaultValue={String(currentId)}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className="h-8 max-w-48 rounded-lg border bg-background px-2 text-sm text-foreground"
        >
          {businesses.map((business) => (
            <option key={business.id} value={business.id}>
              {business.name}
            </option>
          ))}
        </select>
      </label>
    </form>
  );
}