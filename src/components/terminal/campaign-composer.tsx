"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sendCampaignAction } from "@/lib/actions";
import type { Company, Customer } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function CampaignComposer({
  customers,
  companies,
  menuUrl,
  textingReady,
  platform,
}: {
  customers: Customer[];
  companies: Company[];
  menuUrl: string;
  textingReady: boolean;
  platform: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState(
    "This week’s meal prep menu is up. Order and pay from the menu page.",
  );
  const [includeCustomers, setIncludeCustomers] = useState(true);
  const [includeCompanyContacts, setIncludeCompanyContacts] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo.url);
    };
  }, [photo]);

  const recipients = useMemo(() => {
    const seen = new Set<string>();
    const rows: { name: string; phone: string; kind: string }[] = [];
    const push = (name: string, phone: string, kind: string) => {
      const key = phone.replace(/\D/g, "");
      if (key.length < 7 || seen.has(key)) return;
      seen.add(key);
      rows.push({ name, phone, kind });
    };
    if (includeCustomers) {
      for (const customer of customers) push(customer.name, customer.phone, "Customer");
    }
    if (includeCompanyContacts) {
      for (const company of companies) {
        push(company.contactName || company.name, company.phone, "Company contact");
      }
    }
    return rows;
  }, [companies, customers, includeCompanyContacts, includeCustomers]);

  function insertLink() {
    setMessage((current) => (current.includes(menuUrl) ? current : `${current.trim()}\n${menuUrl}`.trim()));
  }

  function clearPhoto() {
    setPhoto(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function onPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();
    const jpeg = type === "image/jpeg" || name.endsWith(".jpg") || name.endsWith(".jpeg");
    const png = type === "image/png" || name.endsWith(".png");
    if ((type && type !== "image/jpeg" && type !== "image/png") || (!jpeg && !png)) {
      setError("Attach a jpg or png.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError("That photo is over 4 MB. Use a smaller jpg or png.");
      return;
    }
    setError("");
    setPhoto({ file, url: URL.createObjectURL(file) });
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    setStatus("");
    let mediaToken = "";
    if (photo) {
      const body = new FormData();
      body.set("photo", photo.file);
      const response = await fetch("/api/text-media", { method: "POST", body });
      const json = (await response.json().catch(() => null)) as { token?: string; error?: string } | null;
      if (!response.ok || !json?.token) {
        setPending(false);
        setError(json?.error || "That photo could not be attached.");
        return;
      }
      mediaToken = json.token;
    }
    const result = await sendCampaignAction({
      message,
      includeCustomers,
      includeCompanyContacts,
      mediaToken,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    clearPhoto();
    const noun = result.recipientCount === 1 ? "text" : "texts";
    const withPhoto = mediaToken ? " with the photo" : "";
    const who = platform === "twilio" ? "Twilio" : "The text platform";
    if (result.mode === "logged") {
      setStatus(`Logged ${result.recipientCount} ${noun}${withPhoto}. Connect a text platform above before a phone can receive them.`);
    } else if (result.failedCount > 0) {
      setStatus(
        `${who} accepted ${result.sentCount}${withPhoto}. ${result.failedCount} failed before acceptance. Accepted is not delivery to the phone. The reason is on that text row below.`,
      );
    } else {
      setStatus(
        `${who} accepted ${result.sentCount} ${noun}${withPhoto}. That is not delivery to the phone. The history stays “accepted, not delivered” until the platform reports the phone.`,
      );
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-start gap-2 rounded-lg border bg-card p-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={includeCustomers}
            onChange={(event) => setIncludeCustomers(event.target.checked)}
          />
          <span>
            <span className="block font-medium">Customers</span>
            <span className="text-muted-foreground">People stored on the customer list.</span>
          </span>
        </label>
        <label className="flex items-start gap-2 rounded-lg border bg-card p-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={includeCompanyContacts}
            onChange={(event) => setIncludeCompanyContacts(event.target.checked)}
          />
          <span>
            <span className="block font-medium">Company contacts</span>
            <span className="text-muted-foreground">The contact phone on each company.</span>
          </span>
        </label>
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="campaign-message" className="text-sm font-medium">
            Message
          </label>
          <Button type="button" variant="outline" size="sm" onClick={insertLink}>
            Insert menu link
          </Button>
        </div>
        <Textarea
          id="campaign-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="min-h-32 bg-card"
          maxLength={480}
          required
        />
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            className="sr-only"
            onChange={onPhoto}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            {photo ? "Replace photo" : "Attach photo"}
          </Button>
          {photo ? (
            <span className="flex min-w-0 items-center gap-2 text-sm">
              <img src={photo.url} alt="" className="size-10 rounded-md border object-cover" />
              <span className="max-w-xs truncate">{photo.file.name}</span>
              <Button type="button" variant="ghost" size="sm" onClick={clearPhoto}>
                Remove
              </Button>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Jpg or png, up to 4 MB. No photo stays a text.</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {message.length}/480. The public order link is added if it is missing when you send.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-3">
        <p className="text-sm font-medium">
          {recipients.length} phone{recipients.length === 1 ? "" : "s"} will be {textingReady ? "texted" : "logged"}
        </p>
        {recipients.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Nobody in that audience has a usable phone number.
          </p>
        ) : (
          <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
            {recipients.map((recipient) => (
              <li key={`${recipient.kind}-${recipient.phone}`}>
                {recipient.name} · {recipient.phone} · {recipient.kind}
              </li>
            ))}
          </ul>
        )}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {status ? (
        <p role="status" className="text-sm">
          {status}
        </p>
      ) : null}

      <div>
        <Button type="submit" disabled={pending || recipients.length === 0}>
          {pending ? "Sending…" : textingReady ? "Send texts" : "Log campaign"}
        </Button>
      </div>
    </form>
  );
}
