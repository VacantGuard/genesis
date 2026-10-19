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
};

export function PublicSite({
  profile,
  menu,
}: {
  profile: BusinessProfile;
  menu: PublicCategory[];
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

  async function pay(event: React.FormEvent) {
    event.preventDefault();
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
          delivery: {
            line1: deliveryLine1,
            line2: deliveryLine2,
            city: deliveryCity,
            state: deliveryState,
            postalCode: deliveryPostalCode,
          },
          card: { name: cardName, number: cardNumber, expiry, cvc },
          lines: lines.map((line) => ({ menuItemId: line.item.id, quantity: line.quantity })),
        }),
      });
      const data = (await response.json()) as Confirmation & { error?: string };
      if (!response.ok) {
        setError(data.error || "The order was not recorded.");
        return;
      }
      setConfirmation({ ...data, last4: cardNumber.replace(/\D/g, "").slice(-4) });
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

  return (
    <div className="min-h-screen pb-24 md:pb-0">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <a href="#top" className="font-heading text-lg tracking-tight">
            {profile.name}
          </a>
          <nav className="flex items-center gap-4 text-sm">
            <a href="#menu" className="hover:text-primary">
              Menu
            </a>
            <a href="#about" className="hover:text-primary">
              About
            </a>
            <a href="#pos" className="hover:text-primary">
              POS
            </a>
            <Link href="/terminal" className="text-muted-foreground hover:text-foreground">
              Staff
            </Link>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="mx-auto max-w-5xl px-4 py-14 sm:py-20">
          <p className="text-xs font-medium tracking-[0.22em] text-primary uppercase">
            Weekly meal prep
          </p>
          <h1 className="font-heading mt-3 max-w-3xl text-5xl leading-[0.95] font-medium tracking-tight sm:text-7xl">
            {profile.name}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Portioned meals for the week. Order and pay on this page — every meal is delivered to your address.
          </p>
        </section>

        <section id="menu" className="scroll-mt-20 border-t">
          <div className="mx-auto max-w-5xl px-4 py-12">
            <div className="mb-8 flex items-end justify-between gap-4">
              <h2 className="font-heading text-3xl font-medium tracking-tight">Menu</h2>
              <p className="text-sm text-muted-foreground">This week</p>
            </div>
            {menu.every((category) => category.items.length === 0) ? (
              <p className="text-muted-foreground">
                The weekly menu is empty. Meals added in the staff terminal show up here.
              </p>
            ) : (
              <div className="grid gap-12">
                {menu.map((category) => (
                  <div key={category.id}>
                    <h3 className="text-xs font-medium tracking-[0.18em] text-primary uppercase">
                      {category.name}
                    </h3>
                    <ul className="mt-4 divide-y">
                      {category.items.map((item) => (
                        <li key={item.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-start">
                          <div>
                            <div className="flex items-baseline gap-3">
                              <p className="font-medium">{item.name}</p>
                              <span className="mb-1 hidden flex-1 border-b border-dotted border-foreground/25 sm:block" />
                              <p className="shrink-0">{formatMoney(item.priceCents)}</p>
                            </div>
                            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                              {item.description}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            {item.available ? (
                              <Button type="button" onClick={() => add(item.id)}>
                                {cart[item.id] ? `Add · ${cart[item.id]}` : "Add"}
                              </Button>
                            ) : (
                              <Badge variant="outline">Sold out</Badge>
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

        <section id="about" className="scroll-mt-20 border-t bg-card">
          <div className="mx-auto grid max-w-5xl gap-6 px-4 py-12 md:grid-cols-[12rem_1fr]">
            <h2 className="font-heading text-3xl font-medium tracking-tight">About</h2>
            <div className="max-w-2xl space-y-4 text-base leading-7 whitespace-pre-wrap">
              {profile.about}
            </div>
          </div>
        </section>

        <section id="pos" className="scroll-mt-20 border-t bg-foreground text-background">
          <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <p className="text-xs font-medium tracking-[0.18em] text-background/70 uppercase">POS</p>
              <h2 className="font-heading mt-2 text-3xl font-medium tracking-tight">Pay and order</h2>
              <p className="mt-3 max-w-md text-sm text-background/75">
                Order this week’s meals for delivery. Practice checkout: the card is checked here and
                the order is marked paid. No charge is sent to a bank.
              </p>
              <div className="mt-6 grid gap-3">
                {lines.length === 0 ? (
                  <p className="text-sm text-background/75">Add a meal from the menu to start an order.</p>
                ) : (
                  lines.map((line) => (
                    <div key={line.item.id} className="flex items-center justify-between gap-3 text-sm">
                      <div>
                        <p>{line.item.name}</p>
                        <p className="text-background/60">
                          {formatMoney(line.item.priceCents)} each
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="size-8 rounded-md border border-background/30"
                          onClick={() => setQuantity(line.item.id, line.quantity - 1)}
                          aria-label={`Remove one ${line.item.name}`}
                        >
                          −
                        </button>
                        <span className="w-6 text-center">{line.quantity}</span>
                        <button
                          type="button"
                          className="size-8 rounded-md border border-background/30"
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
              <p className="mt-6 flex justify-between border-t border-background/20 pt-4 text-lg">
                <span>Total</span>
                <span>{formatMoney(total)}</span>
              </p>
            </div>

            {confirmation ? (
              <div className="rounded-2xl bg-background p-6 text-foreground">
                <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">Paid</p>
                <h3 className="font-heading mt-2 text-4xl tracking-tight">{confirmation.orderNumber}</h3>
                <p className="mt-3 text-sm text-muted-foreground">
                  {confirmation.customerName}, your meal order is paid and queued for delivery
                  {confirmation.deliveryAddress ? ` to ${confirmation.deliveryAddress}` : ""}. Card
                  ending {confirmation.last4}. This was a practice payment.
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
                  className="mt-6"
                  variant="outline"
                  onClick={() => setConfirmation(null)}
                >
                  Start another order
                </Button>
              </div>
            ) : (
              <form onSubmit={pay} className="grid gap-3 rounded-2xl bg-background p-5 text-foreground">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm sm:col-span-2">
                    <span className="font-medium">Name</span>
                    <Input
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      required
                      autoComplete="name"
                      className="h-10 bg-card"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Phone</span>
                    <Input
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      required
                      autoComplete="tel"
                      className="h-10 bg-card"
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
                      className="h-10 bg-card"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm sm:col-span-2">
                    <span className="font-medium">Company</span>
                    <Input
                      value={companyName}
                      onChange={(event) => setCompanyName(event.target.value)}
                      placeholder="Optional"
                      className="h-10 bg-card"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm sm:col-span-2">
                    <span className="font-medium">Delivery street</span>
                    <Input
                      value={deliveryLine1}
                      onChange={(event) => setDeliveryLine1(event.target.value)}
                      required
                      autoComplete="address-line1"
                      className="h-10 bg-card"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm sm:col-span-2">
                    <span className="font-medium">Apt / suite</span>
                    <Input
                      value={deliveryLine2}
                      onChange={(event) => setDeliveryLine2(event.target.value)}
                      autoComplete="address-line2"
                      placeholder="Optional"
                      className="h-10 bg-card"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">City</span>
                    <Input
                      value={deliveryCity}
                      onChange={(event) => setDeliveryCity(event.target.value)}
                      required
                      autoComplete="address-level2"
                      className="h-10 bg-card"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">State</span>
                    <Input
                      value={deliveryState}
                      onChange={(event) => setDeliveryState(event.target.value)}
                      required
                      autoComplete="address-level1"
                      className="h-10 bg-card"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm sm:col-span-2">
                    <span className="font-medium">ZIP</span>
                    <Input
                      value={deliveryPostalCode}
                      onChange={(event) => setDeliveryPostalCode(event.target.value)}
                      required
                      autoComplete="postal-code"
                      className="h-10 bg-card"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm sm:col-span-2">
                    <span className="font-medium">Prep notes</span>
                    <Textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      className="min-h-20 bg-card"
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
                      className="h-10 bg-card"
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
                      className="h-10 bg-card"
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
                      className="h-10 bg-card"
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
                      className="h-10 bg-card"
                    />
                  </label>
                </div>
                {error ? (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                ) : null}
                <Button type="submit" disabled={pending || lines.length === 0} className="mt-2 h-11">
                  {pending ? "Recording payment…" : `Pay ${formatMoney(total)}`}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Use 4242 4242 4242 4242, any future expiry, and any 3-digit code. Only the last
                  four digits are stored.
                </p>
              </form>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground">
          <p>{profile.name}</p>
          <Link href="/terminal" className="hover:text-foreground">
            Staff terminal
          </Link>
        </div>
      </footer>

      {count > 0 && !confirmation ? (
        <a
          href="#pos"
          className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-between rounded-full bg-primary px-4 py-3 text-sm text-primary-foreground shadow-lg md:hidden"
        >
          <span>
            POS · {count} item{count === 1 ? "" : "s"}
          </span>
          <span>{formatMoney(total)}</span>
        </a>
      ) : null}
    </div>
  );
}
