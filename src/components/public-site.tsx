"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DeliveryChoice } from "@/lib/delivery-dates";
import { formatMoney, formatWhen } from "@/lib/format";
import type { PublicReview } from "@/lib/reviews";
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
  deliveryDateLabel?: string;
  deliveryAddress?: string;
  deliveryLocateUrl?: string;
  items: { name: string; quantity: number; unitPriceCents: number; note?: string }[];
  last4: string;
  wallet?: string;
  payment?: string;
  zelleName?: string;
  zelleHandle?: string;
  requiresAction?: boolean;
  clientSecret?: string;
  paymentIntentId?: string;
};

type StripePaymentElement = {
  mount: (el: HTMLElement) => void;
  destroy: () => void;
  on: (
    event: string,
    handler: (event?: { paymentFailed?: (options: { reason: "fail" }) => void }) => void,
  ) => void;
};

type StripeElements = {
  create: (
    type: "payment" | "expressCheckout",
    options?: object,
  ) => StripePaymentElement;
  fetchUpdates: () => Promise<{ error?: { message?: string } }>;
  submit: () => Promise<{ error?: { message?: string } }>;
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

function deliverySentence(confirmation: Confirmation) {
  const when = confirmation.deliveryDateLabel ? ` ${confirmation.deliveryDateLabel}` : "";
  if (confirmation.deliveryAddress) {
    return ` and queued for delivery${when} to ${confirmation.deliveryAddress}`;
  }
  if (when) return ` and queued for delivery${when}`;
  return "";
}

function weekSubtitle(note: string | undefined) {
  const trimmed = note?.trim() ?? "";
  if (!trimmed) return null;
  if (trimmed.startsWith("(") && trimmed.endsWith(")")) return trimmed;
  return `(${trimmed})`;
}

type StripeInstance = {
  elements: (options: {
    clientSecret: string;
    appearance: { theme: "stripe"; variables: { colorPrimary: string; colorText: string; borderRadius: string } };
  }) => StripeElements;
  confirmPayment: (args: {
    elements: StripeElements;
    redirect: "if_required";
    confirmParams: {
      return_url: string;
      receipt_email?: string;
      payment_method_data: {
        billing_details: {
          name?: string;
          email?: string;
          phone?: string;
          address: {
            line1: string;
            line2: string;
            city: string;
            state: string;
            postal_code: string;
            country: "US";
          };
        };
      };
    };
  }) => Promise<{ error?: { message?: string }; paymentIntent?: { id: string; status: string } }>;
};

export function PublicSite({
  profile,
  menu,
  reviews: initialReviews,
  businessSlug,
  accountName,
  stripePublishableKey,
  zelle,
  deliveryChoices,
}: {
  profile: BusinessProfile;
  menu: PublicCategory[];
  reviews: PublicReview[];
  businessSlug: string;
  accountName?: string | null;
  stripePublishableKey?: string | null;
  zelle?: { name: string; handle: string } | null;
  deliveryChoices: DeliveryChoice[];
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
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lineNotes, setLineNotes] = useState<Record<number, string>>({});
  const [smsOptIn, setSmsOptIn] = useState(false);
  const canCard = Boolean(stripePublishableKey);
  const canZelle = Boolean(zelle?.handle);
  const [method, setMethod] = useState<"card" | "zelle">(canCard ? "card" : "zelle");
  const [stripeReady, setStripeReady] = useState(false);
  const [paymentReady, setPaymentReady] = useState(false);
  const stripeRef = useRef<StripeInstance | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const paymentRef = useRef<StripePaymentElement | null>(null);
  const walletRef = useRef<StripePaymentElement | null>(null);
  const completeStripeRef = useRef<() => Promise<boolean>>(async () => false);
  const intentRef = useRef("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [reviews, setReviews] = useState(initialReviews);
  const [reviewAuthor, setReviewAuthor] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewError, setReviewError] = useState("");
  const [reviewPending, setReviewPending] = useState(false);
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
    const ready = () => {
      if (cancelled) return;
      const factory = (window as Window & { Stripe?: (key: string) => StripeInstance }).Stripe;
      if (!factory) {
        setError("Payment checkout could not load.");
        return;
      }
      stripeRef.current = factory(stripePublishableKey);
      setStripeReady(true);
    };
    if ((window as Window & { Stripe?: unknown }).Stripe) {
      ready();
    } else {
      const existing = document.querySelector<HTMLScriptElement>('script[src="https://js.stripe.com/v3/"]');
      const script = existing ?? document.createElement("script");
      script.src = "https://js.stripe.com/v3/";
      script.async = true;
      script.addEventListener("load", ready, { once: true });
      if (!existing) document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      walletRef.current?.destroy();
      walletRef.current = null;
      paymentRef.current?.destroy();
      paymentRef.current = null;
      elementsRef.current = null;
      stripeRef.current = null;
      intentRef.current = "";
      setStripeReady(false);
      setPaymentReady(false);
    };
  }, [stripePublishableKey]);

  const cartKey = lines.map((line) => `${line.item.id}:${line.quantity}`).join(",");
  const linesRef = useRef(lines);
  linesRef.current = lines;

  useEffect(() => {
    if (!stripePublishableKey || !stripeReady || method !== "card") {
      walletRef.current?.destroy();
      walletRef.current = null;
      paymentRef.current?.destroy();
      paymentRef.current = null;
      elementsRef.current = null;
      intentRef.current = "";
      setPaymentReady(false);
      return;
    }
    if (!cartKey || total < 50) {
      walletRef.current?.destroy();
      walletRef.current = null;
      paymentRef.current?.destroy();
      paymentRef.current = null;
      elementsRef.current = null;
      intentRef.current = "";
      setPaymentReady(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const response = await fetch("/api/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            businessSlug,
            paymentIntentId: intentRef.current || undefined,
            lines: linesRef.current.map((line) => ({
              menuItemId: line.item.id,
              quantity: line.quantity,
            })),
          }),
        });
        const data = (await response.json()) as { error?: string; clientSecret?: string; paymentIntentId?: string };
        if (cancelled) return;
        if (!response.ok || !data.clientSecret || !data.paymentIntentId) {
          setError(data.error || "Payment options could not load.");
          return;
        }
        const stripe = stripeRef.current;
        const mount = document.getElementById("stripe-payment");
        const walletMount = document.getElementById("stripe-wallets");
        if (!stripe || !mount) return;
        if (elementsRef.current && intentRef.current === data.paymentIntentId) {
          const refreshed = await elementsRef.current.fetchUpdates();
          if (!cancelled && refreshed.error) setError(refreshed.error.message || "Payment options could not load.");
          return;
        }
        walletRef.current?.destroy();
        paymentRef.current?.destroy();
        const elements = stripe.elements({
          clientSecret: data.clientSecret,
          appearance: {
            theme: "stripe",
            variables: { colorPrimary: "#fc968a", colorText: "#496252", borderRadius: "8px" },
          },
        });
        const payment = elements.create("payment", {
          layout: { type: "accordion", defaultCollapsed: false, radios: "always" },
          wallets: { applePay: "auto", googlePay: "auto" },
          business: { name: profile.name },
          fields: { billingDetails: { name: "never", email: "never", phone: "never", address: "never" } },
        });
        payment.on("ready", () => {
          if (!cancelled) setPaymentReady(true);
        });
        payment.mount(mount);
        elementsRef.current = elements;
        paymentRef.current = payment;
        intentRef.current = data.paymentIntentId;
        if (walletMount) {
          try {
            const wallet = elements.create("expressCheckout", {
              buttonHeight: 48,
              paymentMethods: {
                applePay: "always",
                googlePay: "auto",
                link: "never",
                paypal: "never",
                amazonPay: "never",
              },
            });
            wallet.on("confirm", (event) => {
              void completeStripeRef.current().then((ok) => {
                if (!ok) event?.paymentFailed?.({ reason: "fail" });
              });
            });
            wallet.mount(walletMount);
            walletRef.current = wallet;
          } catch (error) {
            console.error(error);
          }
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [businessSlug, cartKey, method, profile.name, stripePublishableKey, stripeReady, total]);

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
      deliveryDate,
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

  function showConfirmation(data: Confirmation) {
    setConfirmation({
      ...data,
      last4: data.last4 || "",
    });
    setCart({});
    document.getElementById("pos")?.scrollIntoView({ behavior: "smooth" });
  }

  async function pay(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (method === "zelle") {
      if (!zelle) {
        setError("Zelle is not set up on this menu.");
        return;
      }
      setPending(true);
      try {
        const done = await postOrder({ payment: "zelle" });
        if (!done.response.ok) {
          setError(done.data.error || "The Zelle order was not recorded.");
          return;
        }
        showConfirmation(done.data);
      } catch {
        setError("The Zelle order was not recorded. Try again.");
      } finally {
        setPending(false);
      }
      return;
    }
    if (!stripePublishableKey) {
      setError("Stripe is not connected, so the payment was not completed.");
      return;
    }
    await payWithCard();
  }

  async function payWithCard() {
    setError("");
    const stripe = stripeRef.current;
    const elements = elementsRef.current;
    if (!stripe || !elements || !intentRef.current) {
      setError("Payment options are still loading.");
      return false;
    }
    setPending(true);
    try {
      const submitted = await elements.submit();
      if (submitted.error) {
        setError(submitted.error.message || "The payment was not completed.");
        return false;
      }
      const prepared = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(orderPayload({ paymentIntentId: intentRef.current })),
      });
      const preparedData = (await prepared.json()) as { error?: string; paymentIntentId?: string };
      if (!prepared.ok || !preparedData.paymentIntentId) {
        setError(preparedData.error || "The payment was not completed.");
        return false;
      }
      intentRef.current = preparedData.paymentIntentId;
      sessionStorage.setItem("tigeats-order", JSON.stringify(orderPayload({})));
      const confirmed = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
        confirmParams: {
          return_url: `${window.location.origin}${window.location.pathname}`,
          receipt_email: email,
          payment_method_data: {
            billing_details: {
              name: customerName,
              email,
              phone,
              address: {
                line1: deliveryLine1,
                line2: deliveryLine2,
                city: deliveryCity,
                state: deliveryState,
                postal_code: deliveryPostalCode,
                country: "US",
              },
            },
          },
        },
      });
      if (confirmed.error || confirmed.paymentIntent?.status !== "succeeded") {
        setError(confirmed.error?.message || "The payment was not completed.");
        return false;
      }
      const done = await postOrder({ paymentIntentId: confirmed.paymentIntent.id });
      if (!done.response.ok) {
        setError(done.data.error || "The payment went through, but the order was not recorded. Contact the kitchen with this payment.");
        return false;
      }
      sessionStorage.removeItem("tigeats-order");
      showConfirmation(done.data);
      return true;
    } catch {
      setError("The payment was not completed. Try again.");
      return false;
    } finally {
      setPending(false);
    }
  }

  completeStripeRef.current = async () => {
    const missing =
      customerName.trim().length < 2 ||
      phone.replace(/\D/g, "").length < 7 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      deliveryLine1.trim().length < 2 ||
      deliveryCity.trim().length < 2 ||
      deliveryState.trim().length < 2 ||
      deliveryPostalCode.trim().length < 5 ||
      !deliveryChoices.some((choice) => choice.date === deliveryDate);
    if (missing) {
      setError("Enter your name, phone, email, delivery address, and delivery date before Apple Pay.");
      return false;
    }
    return payWithCard();
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentIntentId = params.get("payment_intent");
    const status = params.get("redirect_status");
    if (!paymentIntentId || status !== "succeeded") return;
    const raw = sessionStorage.getItem("tigeats-order");
    if (!raw) return;
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }
    let cancelled = false;
    setPending(true);
    void (async () => {
      try {
        const response = await fetch("/api/orders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...payload, paymentIntentId }),
        });
        const data = (await response.json()) as Confirmation & { error?: string };
        if (cancelled) return;
        if (!response.ok) {
          setError(data.error || "The payment went through, but the order was not recorded. Contact the kitchen with this payment.");
          return;
        }
        sessionStorage.removeItem("tigeats-order");
        const url = new URL(window.location.href);
        url.searchParams.delete("payment_intent");
        url.searchParams.delete("payment_intent_client_secret");
        url.searchParams.delete("redirect_status");
        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
        showConfirmation(data);
      } catch {
        if (!cancelled) setError("The payment went through, but the order was not recorded. Contact the kitchen with this payment.");
      } finally {
        if (!cancelled) setPending(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
              <ul className="mt-10">
                {menu.flatMap((category) => category.items).map((item) => {
                  const nutrition = nutritionLine(item);
                  return (
                    <li key={item.id} className="mx-auto max-w-xl py-6 text-center">
                      {item.photoUrl ? (
                        <img
                          src={item.photoUrl}
                          alt=""
                          className="mx-auto mb-4 h-52 w-full max-w-sm rounded-2xl object-cover"
                        />
                      ) : null}
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
            )}
            <p className="mx-auto mt-10 max-w-xl text-center text-sm leading-6 text-[#5d7568]">
              <span className="font-semibold text-[#496252]">ALLERGY WARNING:</span> Meals are prepared in a
              shared kitchen that handles common allergens, including wheat, gluten, dairy, soy, eggs, fish
              and shellfish. Please disclose all allergies before ordering. Cross-contact may occur.
              Substitutions must be requested in advance and are subject to availability.
            </p>
          </div>
        </section>

        <section id="reviews" className="scroll-mt-24 border-t border-[#a8c09c]/50">
          <div className="mx-auto max-w-3xl px-6 py-16 text-center">
            <h2 className="font-serif text-4xl tracking-tight text-[#496252]">Reviews</h2>
            <CoralUnderline />
            {reviews.length === 0 ? (
              <p className="mt-6 text-sm text-[#5d7568]">No reviews yet. Tell the kitchen how a meal went.</p>
            ) : (
              <ul className="mt-6">
                {reviews.map((review) => (
                  <li key={review.id} className="mx-auto max-w-xl border-b border-[#a8c09c]/40 py-5 last:border-b-0">
                    <p className="text-sm tracking-wide text-[#fc968a]" aria-label={`${review.rating} out of 5`}>
                      {"★".repeat(review.rating)}
                      {"☆".repeat(5 - review.rating)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#496252]">{review.body}</p>
                    <p className="mt-2 text-xs text-[#5d7568]">
                      {review.author} · {formatWhen(review.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <form
              className="mx-auto mt-8 grid max-w-xl gap-3 text-left"
              onSubmit={async (event) => {
                event.preventDefault();
                setReviewError("");
                setReviewPending(true);
                try {
                  const response = await fetch("/api/reviews", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      businessSlug,
                      author: reviewAuthor,
                      rating: reviewRating,
                      body: reviewBody,
                    }),
                  });
                  const data = (await response.json()) as { error?: string; review?: PublicReview };
                  if (!response.ok || !data.review) {
                    setReviewError(data.error || "That review could not be saved.");
                    return;
                  }
                  setReviews((current) => [data.review as PublicReview, ...current]);
                  setReviewAuthor("");
                  setReviewBody("");
                  setReviewRating(5);
                } catch {
                  setReviewError("That review could not be saved.");
                } finally {
                  setReviewPending(false);
                }
              }}
            >
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-[#496252]">Name</span>
                <Input
                  value={reviewAuthor}
                  onChange={(event) => setReviewAuthor(event.target.value)}
                  required
                  maxLength={40}
                  className={publicField}
                />
              </label>
              <fieldset className="grid gap-1.5 text-sm">
                <legend className="font-medium text-[#496252]">Rating</legend>
                <div className="flex flex-wrap gap-2">
                  {[5, 4, 3, 2, 1].map((score) => (
                    <label key={score} className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="rating"
                        value={score}
                        checked={reviewRating === score}
                        onChange={() => setReviewRating(score)}
                      />
                      {score}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-[#496252]">Review</span>
                <Textarea
                  value={reviewBody}
                  onChange={(event) => setReviewBody(event.target.value)}
                  required
                  minLength={4}
                  maxLength={500}
                  className={`min-h-24 ${publicField}`}
                />
              </label>
              {reviewError ? (
                <p role="alert" className="text-sm text-destructive">
                  {reviewError}
                </p>
              ) : null}
              <Button type="submit" disabled={reviewPending} className={publicButton}>
                {reviewPending ? "Saving…" : "Leave a review"}
              </Button>
            </form>
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
                {canCard
                  ? "Choose Apple Pay, a card, or Zelle. Apple Pay shows as its own button when this browser can use it. A Zelle order is paid after the kitchen confirms the transfer. Delivery is Monday or Thursday."
                  : canZelle
                    ? "Pay with Zelle. The kitchen confirms the transfer before the order is paid. Delivery is Monday or Thursday."
                    : "Checkout is waiting on Stripe. Add the publishable key, secret key, and webhook secret under Business in the staff terminal. A payment is not taken until then. Delivery is Monday or Thursday."}
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
                <p className="text-sm text-[#5d7568]">{confirmation.payment === "zelle" ? "Zelle" : "Paid"}</p>
                <h3 className="mt-2 font-serif text-4xl tracking-tight text-[#496252]">{confirmation.orderNumber}</h3>
                <p className="mt-3 text-sm leading-6 text-[#5d7568]">
                  {confirmation.payment === "zelle"
                    ? `${confirmation.customerName}, send ${formatMoney(confirmation.totalCents)} with Zelle to ${confirmation.zelleName} at ${confirmation.zelleHandle}. Put your name in the Zelle note. The kitchen confirms the transfer, then the order is paid${deliverySentence(confirmation)}.`
                    : `${confirmation.customerName}, your meal order is paid${deliverySentence(confirmation)}. ${confirmation.wallet === "apple_pay" ? "Paid with Apple Pay." : confirmation.wallet === "google_pay" ? "Paid with Google Pay." : `Card ending ${confirmation.last4} was charged through Stripe.`}`}
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
                  <fieldset className="grid gap-3 sm:col-span-2">
                    <legend className="font-medium">Delivery date</legend>
                    <p className="text-sm leading-6 text-[#5d7568]">
                      Monday delivery closes Sunday at noon. Thursday delivery closes Wednesday at noon. An order
                      placed Saturday can still choose the coming Thursday.
                    </p>
                    {deliveryChoices.map((choice) => (
                      <label key={choice.date} className="flex items-start gap-2 text-sm">
                        <input
                          type="radio"
                          name="delivery-date"
                          className="mt-1"
                          required
                          checked={deliveryDate === choice.date}
                          onChange={() => setDeliveryDate(choice.date)}
                        />
                        <span>
                          <span className="font-medium">{choice.label}</span>
                          <span className="block text-[#5d7568]">Order by {choice.deadlineLabel}</span>
                        </span>
                      </label>
                    ))}
                  </fieldset>
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
                {canCard || canZelle ? (
                  <fieldset className="mt-2 grid gap-3 border-t pt-4 text-sm">
                    <legend className="font-medium">Payment</legend>
                    {canCard ? (
                      <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="payment-method"
                            checked={method === "card"}
                            onChange={() => setMethod("card")}
                          />
                          Apple Pay or card
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="payment-method"
                            checked={method === "zelle"}
                            onChange={() => setMethod("zelle")}
                          />
                          Zelle
                        </label>
                      </div>
                    ) : null}
                    {method === "zelle" ? (
                      zelle ? (
                        <p className="leading-6 text-[#5d7568]">
                          Send {formatMoney(total)} with Zelle to {zelle.name} at {zelle.handle}. Put your name in the
                          Zelle note. Place the order here, then send the transfer. The kitchen marks it paid when the
                          money arrives.
                        </p>
                      ) : (
                        <p className="leading-6 text-[#5d7568]">
                          Zelle is selected. Add the Zelle email or mobile number under Business in the staff desk, then
                          save it. Customers will see where to send the payment.
                        </p>
                      )
                    ) : (
                      <>
                        <div id="stripe-wallets" className="min-h-12" />
                        <div id="stripe-payment" className="min-h-12" />
                        {lines.length > 0 && !paymentReady ? (
                          <span className="text-xs text-[#5d7568]">Loading Apple Pay and card…</span>
                        ) : (
                          <span className="text-xs text-[#5d7568]">
                            The Apple Pay button shows above the card when this browser can use it. A card works too.
                          </span>
                        )}
                      </>
                    )}
                  </fieldset>
                ) : (
                  <p className="mt-2 border-t border-[#a8c09c]/50 pt-4 text-sm text-[#5d7568]">
                    Stripe is not connected, so this checkout will not take a payment.
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
                {canCard || canZelle ? (
                  <Button
                    type="submit"
                    disabled={pending || lines.length === 0 || (method === "card" && !paymentReady) || (method === "zelle" && !zelle)}
                    className={`mt-2 ${publicButton}`}
                  >
                    {pending
                      ? "Sending…"
                      : method === "zelle"
                        ? `Place Zelle order · ${formatMoney(total)}`
                        : `Pay ${formatMoney(total)}`}
                  </Button>
                ) : null}
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
