"use client";

import { useState } from "react";
import { saveTextPlatformAction } from "@/lib/business-actions";
import type { TextSettings } from "@/lib/messaging";
import { TEXT_PLATFORMS, textFieldCopy } from "@/lib/text-platforms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TextPlatformForm({ settings }: { settings: TextSettings }) {
  const [platform, setPlatform] = useState(settings.platform);
  const copy = textFieldCopy(platform);
  const samePlatform = platform === settings.platform;

  return (
    <form action={saveTextPlatformAction} className="grid max-w-xl gap-3">
      <h2 className="font-heading text-2xl tracking-tight">Text platform</h2>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Platform</span>
        <select
          name="platform"
          value={platform}
          onChange={(event) => setPlatform(event.target.value as TextSettings["platform"])}
          className="h-10 rounded-md border bg-card px-3 text-sm"
        >
          <option value="">Not connected</option>
          {TEXT_PLATFORMS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      {copy.account ? (
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">{copy.account}</span>
          <Input
            key={`${platform}-account`}
            name="accountId"
            defaultValue={samePlatform ? settings.accountId : ""}
            className="h-10 bg-card"
            autoComplete="off"
          />
        </label>
      ) : null}
      {platform ? (
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">{copy.secret}</span>
          <Input
            name="secret"
            type="password"
            placeholder={samePlatform && settings.hasSecret ? "Saved. Paste a new secret to replace it." : "Paste the secret"}
            className="h-10 bg-card"
            autoComplete="off"
          />
        </label>
      ) : null}
      {platform ? (
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">{copy.from}</span>
          <Input
            key={`${platform}-from`}
            name="fromNumber"
            defaultValue={samePlatform ? settings.fromNumber : ""}
            placeholder="+13125550100"
            className="h-10 bg-card"
            autoComplete="off"
          />
        </label>
      ) : null}
      <p className="text-sm text-muted-foreground">
        {settings.ready && samePlatform
          ? `Texts send through ${TEXT_PLATFORMS.find((item) => item.id === platform)?.label}${settings.fromNumber ? ` from ${settings.fromNumber}` : ""}.`
          : copy.hint}
      </p>
      <div>
        <Button type="submit">Save text platform</Button>
      </div>
    </form>
  );
}
