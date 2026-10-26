"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/format";
import type { BusinessProfile, PublicCategory } from "@/lib/types";
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
  items: { name: string; quantity: number; unitPriceCents: number }[];
  last4: string;
  skipPayment?: boolean;
};

export function PublicSite({
  profile,
  menu,
  businessSlug,
  accountName,
}: {
  profile: BusinessProfile;
  menu: PublicCategory[];
  businessSlug: string;
  accountName?: string | null;
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
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

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
  }

  async function submitOrder(skipPayment: boolean) {
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerName,
          phone,
          email,
          companyName,
          notes,
          smsOptIn,
          skipPayment,
          delivery: {
            line1: deliveryLine1,
            line2: deliveryLine2,
            city: deliveryCity,
            state: deliveryState,
            postalCode: deliveryPostalCode,
          },
          businessSlug,
          card: skipPayment
            ? undefined
            : { name: cardName, number: cardNumber, expiry, cvc },
          lines: lines.map((line) => ({ menuItemId: line.item.id, quantity: line.quantity })),
        }),
      });
      const data = (await response.json()) as Confirmation & { error?: string; skipPayment?: boolean };
      if (!response.ok) {
        setError(data.error || "The order was not recorded.");
        return;
      }
      setConfirmation({
        ...data,
        last4: skipPayment ? "TEST" : cardNumber.replace(/\D/g, "").slice(-4),
        skipPayment,
      });
      setCart({});
      setCardNumber("");
      setCvc("");
      document.getElementById("pos")?.scrollIntoView({ behavior: "smooth" });
    } catch {
      setError("The kitchen could not be reached. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function pay(event: React.FormEvent) {
    event.preventDefault();
    await submitOrder(false);
  }

  const field = "h-10 rounded bg-[#f4f4f4] border-0 shadow-none focus-visible:ring-[#171a20]";

  return (
    <div className="min-h-screen bg-white pb-16 text-[#171a20] md:pb-0">
      <header className="fixed inset-x-0 top-0 z-30 bg-[#171a20]/80 text-white backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <a href="#top" className="text-sm font-medium tracking-wide">
            {profile.name}
          </a>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <a href="#menu" className="hidden hover:text-white/80 sm:inline">
              Menu
            </a>
            <a href="#about" className="hidden hover:text-white/80 sm:inline">
              About
            </a>
            <a href="#pos" className="hover:text-white/80">
              Order
            </a>
            <Link href={accountName ? "/account" : "/account/login"} className="hover:text-white/80">
              {accountName ? accountName.split(" ")[0] : "Sign in"}
            </Link>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="flex min-h-[100svh] flex-col items-center justify-end bg-[#171a20] px-6 pb-24 pt-20 text-center text-white">
          <h1 className="text-5xl font-medium tracking-tight sm:text-7xl">{profile.name}</h1>
          <p className="mt-3 max-w-md text-sm text-white/80">
            Portioned meals for the week. Order here for delivery.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a
              href="#pos"
              className="inline-flex h-10 min-w-40 items-center justify-center rounded bg-white px-8 text-sm font-medium text-[#171a20]"
            >
              Order
            </a>
            <a
              href="#menu"
              className="inline-flex h-10 min-w-40 items-center justify-center rounded bg-white/15 px-8 text-sm font-medium text-white backdrop-blur"
            >
              Menu
            </a>
          </div>
        </section>

        <section id="menu" className="scroll-mt-14 bg-white">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <h2 className="text-center text-4xl font-medium tracking-tight">This week</h2>
            {menu.every((category) => category.items.length === 0) ? (
              <p className="mt-8 text-center text-sm text-[#5c5e62]">
                The weekly menu is empty. Meals added in the staff terminal show up here.
              </p>
            ) : (
              <div className="mt-14 grid gap-16">
                {menu.map((category) => (
                  <div key={category.id}>
                    <h3 className="text-sm tracking-[0.16em] text-[#5c5e62] uppercase">{category.name}</h3>
                    <ul className="mt-4">
                      {category.items.map((item) => (
                        <li
                          key={item.id}
                          className="grid gap-4 border-b border-black/10 py-8 sm:grid-cols-[1fr_auto] sm:items-center"
                        >
                          <div>
                            <div className="flex items-baseline justify-between gap-6">
                              <p className="text-2xl font-medium tracking-tight">{item.name}</p>
                              <p className="text-sm">{formatMoney(item.priceCents)}</p>
                            </div>
                            <p className="mt-2 max-w-xl text-sm text-[#5c5e62]">{item.description}</p>
                          </div>
                          <div>
                            {item.available ? (
                              <Button
                                type="button"
                                onClick={() => add(item.id)}
                                className="h-10 min-w-28 rounded bg-[#171a20] text-white hover:bg-black"
                              >
                                {cart[item.id] ? `Added ${cart[item.id]}` : "Add"}
                              </Button>
                            ) : (
                              <Badge variant="outline" className="rounded border-black/20 text-[#5c5e62]">
                                Sold out
                              </Badge>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section id="about" className="scroll-mt-14 bg-[#171a20] text-white">
          <div className="mx-auto max-w-3xl px-6 py-24 text-center">
            <h2 className="text-4xl font-medium tracking-tight">About</h2>
            <div className="mt-6 text-sm leading-7 whitespace-pre-wrap text-white/80">{profile.about}</div>
          </div>
        </section>

        <section id="pos" className="scroll-mt-14 bg-[#f4f4f4]">
          <div className="mx-auto grid max-w-5xl gap-12 px-6 py-20 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <h2 className="text-4xl font-medium tracking-tight">Order</h2>
              <p className="mt-3 max-w-md text-sm text-[#5c5e62]">
                Practice checkout. The card is checked here and the order is marked paid. No charge
                is sent to a bank.
              </p>
              <div className="mt-6 grid gap-3">
                {lines.length === 0 ? (
                  <p className="text-sm text-background/75">Add a meal from the menu to start an order.</p>
                ) : (
                  lines.map((line) => (
                    <div key={line.item.id} className="flex items-center justify-between gap-3 text-sm">
                      <div>
                        <p>{line.item.name}</p>
                        <p className="text-[#5c5e62]">{formatMoney(line.item.priceCents)} each</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="size-8 rounded bg-white"
                          onClick={() => setQuantity(line.item.id, line.quantity - 1)}
                          aria-label={`Remove one ${line.item.name}`}
                        >
                          −
                        </button>
                        <span className="w-6 text-center">{line.quantity}</span>
                        <button
                          type="button"
                          className="size-8 rounded bg-white"
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
                  ))
                )}
              </div>
              <p className="mt-6 flex justify-between border-t border-black/10 pt-4 text-lg">
                <span>Total</span>
                <span>{formatMoney(total)}</span>
              </p>
            </div>

            {confirmation ? (
              <div className="bg-white p-8">
                <p className="text-sm text-[#5c5e62]">Paid</p>
                <h3 className="mt-2 text-4xl font-medium tracking-tight">{confirmation.orderNumber}</h3>
                <p className="mt-3 text-sm text-muted-foreground">
                  {confirmation.customerName}, your meal order is{" "}
                  {confirmation.skipPayment ? "recorded for testing (no payment)" : "paid"}
                  {confirmation.deliveryAddress
                    ? ` and queued for delivery to ${confirmation.deliveryAddress}`
                    : ""}
                  .
                  {confirmation.skipPayment
                    ? " No card was used."
                    : ` Card ending ${confirmation.last4}. This was a practice payment.`}
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
                <ul className="mt-4 grid gap-1 text-sm">
                  {confirmation.items.map((item) => (
                    <li key={item.name} className="flex justify-between gap-3">
                      <span>
                        {item.quantity} × {item.name}
                      </span>
                      <span>{formatMoney(item.unitPriceCents * item.quantity)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 font-medium">{formatMoney(confirmation.totalCents)}</p>
                <Button
                  type="button"
                  className="mt-6 h-10 rounded bg-[#171a20] text-white hover:bg-black"
                  onClick={() => setConfirmation(null)}
                >
                  Start another order
                </Button>
              </div>
            ) : (
              <form onSubmit={pay} className="grid gap-3 bg-white p-6 sm:p-8">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm sm:col-span-2">
                    <span className="font-medium">Name</span>
                    <Input
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      required
                      autoComplete="name"
                      className={field}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Phone</span>
                    <Input
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      required
                      autoComplete="tel"
                      className={field}
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
                      className={field}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm sm:col-span-2">
                    <span className="font-medium">Company</span>
                    <Input
                      value={companyName}
                      onChange={(event) => setCompanyName(event.target.value)}
                      placeholder="Optional"
                      className={field}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm sm:col-span-2">
                    <span className="font-medium">Delivery street</span>
                    <Input
                      value={deliveryLine1}
                      onChange={(event) => setDeliveryLine1(event.target.value)}
                      required
                      autoComplete="address-line1"
                      className={field}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm sm:col-span-2">
                    <span className="font-medium">Apt / suite</span>
                    <Input
                      value={deliveryLine2}
                      onChange={(event) => setDeliveryLine2(event.target.value)}
                      autoComplete="address-line2"
                      placeholder="Optional"
                      className={field}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">City</span>
                    <Input
                      value={deliveryCity}
                      onChange={(event) => setDeliveryCity(event.target.value)}
                      required
                      autoComplete="address-level2"
                      className={field}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">State</span>
                    <Input
                      value={deliveryState}
                      onChange={(event) => setDeliveryState(event.target.value)}
                      required
                      autoComplete="address-level1"
                      className={field}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm sm:col-span-2">
                    <span className="font-medium">ZIP</span>
                    <Input
                      value={deliveryPostalCode}
                      onChange={(event) => setDeliveryPostalCode(event.target.value)}
                      required
                      autoComplete="postal-code"
                      className={field}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm sm:col-span-2">
                    <span className="font-medium">Prep notes</span>
                    <Textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      className={`min-h-20 ${field}`}
                      placeholder="Optional"
                    />
                  </label>
                </div>
                <div className="mt-2 grid gap-3 border-t pt-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm sm:col-span-2">
                    <span className="font-medium">Name on card</span>
                    <Input
                      value={cardName}
                      onChange={(event) => setCardName(event.target.value)}
                      required
                      autoComplete="cc-name"
                      className={field}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm sm:col-span-2">
                    <span className="font-medium">Card number</span>
                    <Input
                      inputMode="numeric"
                      autoComplete="cc-number"
                      value={cardNumber}
                      onChange={(event) => setCardNumber(event.target.value)}
                      placeholder="4242 4242 4242 4242"
                      required
                      className={field}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Expiry</span>
                    <Input
                      value={expiry}
                      onChange={(event) => setExpiry(event.target.value)}
                      placeholder="12/28"
                      autoComplete="cc-exp"
                      required
                      className={field}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">CVC</span>
                    <Input
                      value={cvc}
                      onChange={(event) => setCvc(event.target.value)}
                      placeholder="123"
                      autoComplete="cc-csc"
                      required
                      className={field}
                    />
                  </label>
                </div>
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
                <Button
                  type="submit"
                  disabled={pending || lines.length === 0}
                  className="mt-2 h-10 rounded bg-[#3e6ae1] text-white hover:bg-[#3457b1]"
                >
                  {pending ? "Recording payment…" : `Pay ${formatMoney(total)}`}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending || lines.length === 0}
                  className="h-10 rounded"
                  onClick={() => void submitOrder(true)}
                >
                  {pending ? "Recording order…" : "Place test order (no card)"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Practice card: 4242 4242 4242 4242, any future expiry, any 3-digit code. Or use
                  “Place test order (no card)” to checkout without payment for testing. Only the last
                  four digits are stored when a card is used.
                </p>
              </form>
            )}
          </div>
        </section>
      </main>

      <footer className="bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-xs text-[#5c5e62]">
          <p>{profile.name}</p>
          <span className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms and Conditions
            </Link>
            <Link href="/terminal" className="hover:text-foreground">
              Staff terminal
            </Link>
          </span>
        </div>
      </footer>

      {count > 0 && !confirmation ? (
        <a
          href="#pos"
          className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between bg-[#171a20] px-6 py-4 text-sm text-white md:hidden"
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
