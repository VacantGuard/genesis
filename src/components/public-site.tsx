"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatMoney } from "@/lib/format";
import type { BusinessProfile, PublicCategory, PublicMenuItem } from "@/lib/types";
import { CoralUnderline, PublicFooter, PublicHeader, publicButton, publicField } from "@/components/public-chrome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Confirmation = {
  orderNumber: string;
  totalCents: number;
  customerName: string;
  deliveryAddress?: string;
  deliveryLocateUrl?: string;
  items: { name: string; quantity: number; unitPriceCents: number; note?: string }[];
  last4: string;
  skipPayment?: boolean;
  requiresAction?: boolean;
  clientSecret?: string;
  paymentIntentId?: string;
};

type StripeCard = {
  mount: (el: HTMLElement) => void;
  destroy: () => void;
};

function nutritionLine(item: PublicMenuItem) {
  const parts: string[] = [];
  if (item.calories != null && String(item.calories).trim() !== "") {
    const raw = String(item.calories).trim();
    parts.push(/cal/i.test(raw) ? raw : `${raw} calories`);
  }
  if (item.protein != null && String(item.protein).trim() !== "") {
    const raw = String(item.protein).trim();
    if (/protein/i.test(raw)) parts.push(raw);
    else if (/g\b/i.test(raw)) parts.push(`${raw} protein`);
    else parts.push(`${raw}g protein`);
  }
  return parts.join(" | ");
}

function weekSubtitle(note: string | undefined) {
  const trimmed = note?.trim() ?? "";
  if (!trimmed) return null;
  if (trimmed.startsWith("(") && trimmed.endsWith(")")) return trimmed;
  return `(${trimmed})`;
}

type StripeInstance = {
  elements: () => { create: (type: "card") => StripeCard };
  createPaymentMethod: (args: {
    type: "card";
    card: StripeCard;
    billing_details?: { name?: string; email?: string; phone?: string };
  }) => Promise<{ error?: { message?: string }; paymentMethod?: { id: string } }>;
  confirmCardPayment: (clientSecret: string) => Promise<{
    error?: { message?: string };
    paymentIntent?: { id: string; status: string };
  }>;
};

export function PublicSite({
  profile,
  menu,
  businessSlug,
  accountName,
  stripePublishableKey,
}: {
  profile: BusinessProfile;
  menu: PublicCategory[];
  businessSlug: string;
  accountName?: string | null;
  stripePublishableKey?: string | null;
}) {
  const [cart, setCart] = useState<Record<number, number>>({});
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [deliveryLine1, setDeliveryLine1] = useState("");
  const [deliveryLine2, setDeliveryLine2] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryState, setDeliveryState] = useState("");
  const [deliveryPostalCode, setDeliveryPostalCode] = useState("");
  const [notes, setNotes] = useState("");
  const [lineNotes, setLineNotes] = useState<Record<number, string>>({});
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [stripeReady, setStripeReady] = useState(false);
  const stripeRef = useRef<StripeInstance | null>(null);
  const cardRef = useRef<StripeCard | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const weekLine = weekSubtitle(profile.weekNote);

  const lookup = useMemo(() => {
    const map = new Map<number, PublicCategory["items"][number]>();
    for (const category of menu) {
      for (const item of category.items) map.set(item.id, item);
    }
    return map;
  }, [menu]);

  const lines = Object.entries(cart)
    .map(([id, quantity]) => {
      const item = lookup.get(Number(id));
      if (!item) return null;
      return { item, quantity };
    })
    .filter((line): line is { item: PublicCategory["items"][number]; quantity: number } =>
      Boolean(line),
    );

  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = lines.reduce((sum, line) => sum + line.item.priceCents * line.quantity, 0);

  useEffect(() => {
    if (!stripePublishableKey) return;
    let cancelled = false;
    const mountCard = () => {
      if (cancelled) return;
      const factory = (window as Window & { Stripe?: (key: string) => StripeInstance }).Stripe;
      const mount = document.getElementById("stripe-card");
      if (!factory || !mount) {
        setError("Card checkout could not load.");
        return;
      }
      const stripe = factory(stripePublishableKey);
      const card = stripe.elements().create("card");
      card.mount(mount);
      stripeRef.current = stripe;
      cardRef.current = card;
      setStripeReady(true);
    };
    if ((window as Window & { Stripe?: unknown }).Stripe) {
      mountCard();
    } else {
      const existing = document.querySelector<HTMLScriptElement>('script[src="https://js.stripe.com/v3/"]');
      const script = existing ?? document.createElement("script");
      script.src = "https://js.stripe.com/v3/";
      script.async = true;
      script.addEventListener("load", mountCard, { once: true });
      if (!existing) document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      cardRef.current?.destroy();
      cardRef.current = null;
      stripeRef.current = null;
      setStripeReady(false);
    };
  }, [stripePublishableKey]);

  function add(id: number) {
    setConfirmation(null);
    setCart((current) => ({ ...current, [id]: Math.min(25, (current[id] ?? 0) + 1) }));
  }

  function setQuantity(id: number, quantity: number) {
    setCart((current) => {
      const next = { ...current };
      if (quantity <= 0) delete next[id];
      else next[id] = Math.min(25, quantity);
      return next;
    });
    if (quantity <= 0) {
      setLineNotes((current) => {
        if (!(id in current)) return current;
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
  }

  function setLineNote(id: number, note: string) {
    setLineNotes((current) => ({ ...current, [id]: note }));
  }

  function orderPayload(extra: Record<string, unknown>) {
    return {
      customerName,
      phone,
      email,
      companyName,
      notes,
      smsOptIn,
      delivery: {
        line1: deliveryLine1,
        line2: deliveryLine2,
        city: deliveryCity,
        state: deliveryState,
        postalCode: deliveryPostalCode,
      },
      businessSlug,
      lines: lines.map((line) => ({
        menuItemId: line.item.id,
        quantity: line.quantity,
        note: lineNotes[line.item.id] ?? "",
      })),
      ...extra,
    };
  }

  async function postOrder(extra: Record<string, unknown>) {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(orderPayload(extra)),
    });
    const data = (await response.json()) as Confirmation & { error?: string };
    return { response, data };
  }

  function showConfirmation(data: Confirmation, skipPayment: boolean) {
    setConfirmation({
      ...data,
      last4: data.last4 || (skipPayment ? "TEST" : ""),
      skipPayment,
    });
    setCart({});
    document.getElementById("pos")?.scrollIntoView({ behavior: "smooth" });
  }

  async function submitOrder(skipPayment: boolean) {
    setError("");
    setPending(true);
    try {
      const { response, data } = await postOrder({ skipPayment });
      if (!response.ok) {
        setError(data.error || "The order was not recorded.");
        return;
      }
      showConfirmation(data, skipPayment);
    } catch {
      setError("The kitchen could not be reached. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function pay(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!stripePublishableKey) {
      setError("Stripe is not connected, so the card was not charged.");
      return;
    }
    const stripe = stripeRef.current;
    const card = cardRef.current;
    if (!stripe || !card) {
      setError("Card checkout is still loading.");
      return;
    }
    setPending(true);
    try {
      const created = await stripe.createPaymentMethod({
        type: "card",
        card,
        billing_details: { name: customerName, email, phone },
      });
      if (created.error || !created.paymentMethod) {
        setError(created.error?.message || "The card was not charged.");
        return;
      }
      let { response, data } = await postOrder({ paymentMethodId: created.paymentMethod.id });
      if (data.requiresAction && data.clientSecret) {
        const confirmed = await stripe.confirmCardPayment(data.clientSecret);
        if (confirmed.error || confirmed.paymentIntent?.status !== "succeeded") {
          setError(confirmed.error?.message || "The card was not charged.");
          return;
        }
        const done = await postOrder({ paymentIntentId: confirmed.paymentIntent.id });
        response = done.response;
        data = done.data;
      }
      if (!response.ok) {
        setError(data.error || "The card was not charged.");
        return;
      }
      showConfirmation(data, false);
    } catch {
      setError("The card was not charged. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#fdeae3] pb-16 text-[#496252] md:pb-0">
      <PublicHeader accountName={accountName} sectionLinks />

      <main id="top">
        <section id="menu" className="scroll-mt-24">
          <div className="mx-auto max-w-3xl px-6 pt-14 pb-6 text-center">
            <h1 className="font-serif text-5xl tracking-tight text-[#496252] sm:text-6xl">menu of the week</h1>
            {weekLine ? (
              <p className="mt-2 font-serif text-2xl tracking-tight text-[#496252] sm:text-3xl">{weekLine}</p>
            ) : null}
            <CoralUnderline />
            <p className="mx-auto mt-5 max-w-md text-sm leading-6 text-[#5d7568]">
              Portioned meals for the week. Order here for delivery.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <a
                href="#pos"
                className="inline-flex h-10 min-w-36 items-center justify-center rounded-full bg-[#fc968a] px-6 text-sm font-medium text-white hover:bg-[#f07d70]"
              >
                Order
              </a>
              <a
                href="#about"
                className="inline-flex h-10 min-w-36 items-center justify-center rounded-full border border-[#a8c09c] px-6 text-sm font-medium text-[#496252] hover:bg-white/60"
              >
                About
              </a>
            </div>
          </div>
          <div className="mx-auto max-w-3xl px-6 pb-16">
            {menu.every((category) => category.items.length === 0) ? (
              <p className="mt-8 text-center text-sm text-[#5d7568]">
                The weekly menu is empty. Meals added in the staff terminal show up here.
              </p>
            ) : (
              <div className="mt-10 grid gap-12">
                {menu.map((category) => (
                  <div key={category.id}>
                    <h2 className="text-center text-xs tracking-[0.18em] text-[#5d7568] uppercase">
                      {category.name}
                    </h2>
                    <ul className="mt-2">
                      {category.items.map((item) => {
                        const nutrition = nutritionLine(item);
                        return (
                          <li key={item.id} className="mx-auto max-w-xl py-6 text-center">
                            <p className="text-lg font-semibold tracking-tight text-[#496252]">{item.name}</p>
                            {item.description ? (
                              <p className="mt-1 text-sm leading-6 text-[#496252]">{item.description}</p>
                            ) : null}
                            {nutrition ? <p className="mt-1 text-sm text-[#496252]">{nutrition}</p> : null}
                            <p className="mt-2 text-sm text-[#5d7568]">{formatMoney(item.priceCents)}</p>
                            <div className="mt-3">
                              {item.available ? (
                                <Button
                                  type="button"
                                  onClick={() => add(item.id)}
                                  className="h-9 min-w-28 rounded-full bg-[#fc968a] text-white hover:bg-[#f07d70]"
                                >
                                  {cart[item.id] ? `Added ${cart[item.id]}` : "Add"}
                                </Button>
                              ) : (
                                <Badge variant="outline" className="rounded-full border-[#a8c09c] text-[#5d7568]">
                                  Sold out
                                </Badge>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section id="about" className="scroll-mt-24 border-t border-[#a8c09c]/50">
          <div className="mx-auto max-w-3xl px-6 py-16 text-center">
            <h2 className="font-serif text-4xl tracking-tight text-[#496252]">About</h2>
            <CoralUnderline />
            <div className="mt-6 text-sm leading-7 whitespace-pre-wrap text-[#5d7568]">{profile.about}</div>
          </div>
        </section>

        <section id="pos" className="scroll-mt-24 border-t border-[#a8c09c]/50">
          <div className="mx-auto grid max-w-5xl gap-12 px-6 py-16 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <h2 className="font-serif text-4xl tracking-tight text-[#496252]">Order</h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-[#5d7568]">
                {stripePublishableKey
                  ? "Pay with a card. Stripe charges it, then the order is marked paid."
                  : "Card checkout is waiting on Stripe. Add the publishable key, secret key, and webhook secret under Business in the staff terminal. A card is not charged until then."}
              </p>
              <div className="mt-6 grid gap-3">
                {lines.length === 0 ? (
                  <p className="text-sm text-[#5d7568]">Add a meal from the menu to start an order.</p>
                ) : (
                  lines.map((line) => (
                    <div key={line.item.id} className="grid gap-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p>{line.item.name}</p>
                          <p className="text-[#5d7568]">{formatMoney(line.item.priceCents)} each</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="size-8 rounded-full bg-white text-[#496252]"
                            onClick={() => setQuantity(line.item.id, line.quantity - 1)}
                            aria-label={`Remove one ${line.item.name}`}
                          >
                            −
                          </button>
                          <span className="w-6 text-center">{line.quantity}</span>
                          <button
                            type="button"
                            className="size-8 rounded-full bg-white text-[#496252]"
                            onClick={() => setQuantity(line.item.id, line.quantity + 1)}
                            aria-label={`Add one ${line.item.name}`}
                          >
                            +
                          </button>
                          <span className="w-16 text-right">
                            {formatMoney(line.item.priceCents * line.quantity)}
                          </span>
                        </div>
                      </div>
                      <label className="grid gap-1">
                        <span className="text-[#5d7568]">Alteration</span>
                        <Input
                          value={lineNotes[line.item.id] ?? ""}
                          onChange={(event) => setLineNote(line.item.id, event.target.value)}
                          maxLength={200}
                          placeholder="No onion, sauce on the side"
                          aria-label={`Alteration for ${line.item.name}`}
                          className={publicField}
                        />
                      </label>
                    </div>
                  ))
                )}
              </div>
              <p className="mt-6 flex justify-between border-t border-[#a8c09c]/50 pt-4 text-lg">
                <span>Total</span>
                <span>{formatMoney(total)}</span>
              </p>
            </div>

            {confirmation ? (
              <div className="rounded-3xl bg-white p-8">
                <p className="text-sm text-[#5d7568]">Paid</p>
                <h3 className="mt-2 font-serif text-4xl tracking-tight text-[#496252]">{confirmation.orderNumber}</h3>
                <p className="mt-3 text-sm leading-6 text-[#5d7568]">
                  {confirmation.customerName}, your meal order is{" "}
                  {confirmation.skipPayment ? "recorded for testing (no payment)" : "paid"}
                  {confirmation.deliveryAddress
                    ? ` and queued for delivery to ${confirmation.deliveryAddress}`
                    : ""}
                  .
                  {confirmation.skipPayment
                    ? " No card was used."
                    : ` Card ending ${confirmation.last4} was charged through Stripe.`}
                  {smsOptIn
                    ? ` You are enrolled in ${profile.name} menu texts. A confirmation text welcomes you to the program. Reply STOP to opt out or HELP for help.`
                    : ""}
                </p>
                {confirmation.deliveryLocateUrl ? (
                  <p className="mt-2 text-sm">
                    <a
                      href={confirmation.deliveryLocateUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      Open delivery location on map
                    </a>
                  </p>
                ) : null}
                <ul className="mt-4 grid gap-2 text-sm">
                  {confirmation.items.map((item, index) => (
                    <li key={`${item.name}-${index}`} className="flex justify-between gap-3">
                      <span>
                        {item.quantity} × {item.name}
                        {item.note ? <span className="block text-[#5d7568]">{item.note}</span> : null}
                      </span>
                      <span>{formatMoney(item.unitPriceCents * item.quantity)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 font-medium">{formatMoney(confirmation.totalCents)}</p>
                <Button
                  type="button"
                  className={`mt-6 ${publicButton}`}
                  onClick={() => setConfirmation(null)}
                >
                  Start another order
                </Button>
              </div>
            ) : (
              <form onSubmit={pay} className="grid gap-3 rounded-3xl bg-white p-6 sm:p-8">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm sm:col-span-2">
                    <span className="font-medium">Name</span>
                    <Input
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      required
                      autoComplete="name"
                      className={publicField}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Phone</span>
                    <Input
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      required
                      autoComplete="tel"
                      className={publicField}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Email</span>
                    <Input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                      autoComplete="email"
                      className={publicField}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm sm:col-span-2">
                    <span className="font-medium">Company</span>
                    <Input
                      value={companyName}
                      onChange={(event) => setCompanyName(event.target.value)}
                      placeholder="Optional"
                      className={publicField}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm sm:col-span-2">
                    <span className="font-medium">Delivery street</span>
                    <Input
                      value={deliveryLine1}
                      onChange={(event) => setDeliveryLine1(event.target.value)}
                      required
                      autoComplete="address-line1"
                      className={publicField}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm sm:col-span-2">
                    <span className="font-medium">Apt / suite</span>
                    <Input
                      value={deliveryLine2}
                      onChange={(event) => setDeliveryLine2(event.target.value)}
                      autoComplete="address-line2"
                      placeholder="Optional"
                      className={publicField}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">City</span>
                    <Input
                      value={deliveryCity}
                      onChange={(event) => setDeliveryCity(event.target.value)}
                      required
                      autoComplete="address-level2"
                      className={publicField}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">State</span>
                    <Input
                      value={deliveryState}
                      onChange={(event) => setDeliveryState(event.target.value)}
                      required
                      autoComplete="address-level1"
                      className={publicField}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm sm:col-span-2">
                    <span className="font-medium">ZIP</span>
                    <Input
                      value={deliveryPostalCode}
                      onChange={(event) => setDeliveryPostalCode(event.target.value)}
                      required
                      autoComplete="postal-code"
                      className={publicField}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm sm:col-span-2">
                    <span className="font-medium">Prep notes</span>
                    <Textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      className={`min-h-20 ${publicField}`}
                      placeholder="Optional"
                    />
                  </label>
                </div>
                {stripePublishableKey ? (
                  <div className="mt-2 grid gap-1.5 border-t pt-4 text-sm">
                    <span className="font-medium">Card</span>
                    <div id="stripe-card" className="rounded-lg border border-[#a8c09c]/50 bg-white px-3 py-3" />
                  </div>
                ) : (
                  <p className="mt-2 border-t border-[#a8c09c]/50 pt-4 text-sm text-[#5d7568]">
                    Stripe is not connected, so this checkout will not charge a card.
                  </p>
                )}
                {error ? (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                ) : null}
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="smsOptIn"
                    checked={smsOptIn}
                    onChange={(event) => setSmsOptIn(event.target.checked)}
                    className="mt-1 size-4"
                  />
                  <span>
                    I agree to receive weekly menu texts from {profile.name}. About one to four
                    messages a week. Message and data rates may apply. Reply STOP to opt out or HELP
                    for help. This box is optional and is not required to place an order. See the{" "}
                    <Link href="/privacy" className="underline">
                      Privacy Policy
                    </Link>{" "}
                    and{" "}
                    <Link href="/terms" className="underline">
                      Terms and Conditions
                    </Link>
                    .
                  </span>
                </label>
                {stripePublishableKey ? (
                  <Button
                    type="submit"
                    disabled={pending || lines.length === 0 || !stripeReady}
                    className={`mt-2 ${publicButton}`}
                  >
                    {pending ? "Charging card…" : `Pay ${formatMoney(total)}`}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending || lines.length === 0}
                  className="h-10 rounded-full border-[#a8c09c] text-[#496252]"
                  onClick={() => void submitOrder(true)}
                >
                  {pending ? "Recording order…" : "Place test order (no card)"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {stripePublishableKey
                    ? "Pay charges the card through Stripe. Place test order records a ticket without charging a card."
                    : "Place test order records a ticket without charging a card. Pay stays off until Stripe is connected under Business."}
                </p>
              </form>
            )}
          </div>
        </section>
      </main>

      <PublicFooter />

      {count > 0 && !confirmation ? (
        <a
          href="#pos"
          className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between bg-[#fc968a] px-6 py-4 text-sm text-white md:hidden"
        >
          <span>
            Order · {count} item{count === 1 ? "" : "s"}
          </span>
          <span>{formatMoney(total)}</span>
        </a>
      ) : null}
    </div>
  );
}
