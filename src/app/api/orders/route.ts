import { NextResponse } from "next/server";
import { getBusinessBySlug, getHomepageBusiness } from "@/lib/businesses";
import { OrderError } from "@/lib/db";
import { readDeliveryAddress, validateDeliveryAddress } from "@/lib/delivery";
import { recordPaidOrder, recordZelleOrder } from "@/lib/order-alert";
import { cleanLineNote, priceOrderLines } from "@/lib/orders";
import { chargeCard, paidIntent, stripeSettings } from "@/lib/stripe";
import { zelleAccount } from "@/lib/zelle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  businessSlug?: string;
  customerName?: string;
  phone?: string;
  email?: string;
  companyName?: string;
  notes?: string;
  smsOptIn?: boolean;
  delivery?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
  payment?: string;
  paymentMethodId?: string;
  paymentIntentId?: string;
  lines?: { menuItemId?: number; quantity?: number; note?: string }[];
};

function clean(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "The order could not be read." }, { status: 400 });
  }

  const customerName = clean(body.customerName, 80);
  const phone = clean(body.phone, 40);
  const email = clean(body.email, 120);
  const companyName = clean(body.companyName, 80);
  const notes = clean(body.notes, 400);

  if (customerName.length < 2) {
    return NextResponse.json({ error: "Enter the name for the ticket." }, { status: 400 });
  }
  if (phone.replace(/\D/g, "").length < 7) {
    return NextResponse.json({ error: "Enter a phone number for the ticket." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter an email for the receipt." }, { status: 400 });
  }

  const delivery = readDeliveryAddress(body.delivery ?? {});
  const deliveryError = validateDeliveryAddress(delivery);
  if (deliveryError) {
    return NextResponse.json({ error: deliveryError }, { status: 400 });
  }

  const lines = Array.isArray(body.lines) ? body.lines : [];
  const merged = new Map<number, number>();
  const lineNotes = new Map<number, string>();
  for (const line of lines) {
    const menuItemId = Number(line.menuItemId);
    const quantity = Number(line.quantity);
    if (!Number.isInteger(menuItemId) || !Number.isInteger(quantity)) continue;
    merged.set(menuItemId, (merged.get(menuItemId) ?? 0) + quantity);
    const note = cleanLineNote(line.note);
    if (note && !lineNotes.has(menuItemId)) lineNotes.set(menuItemId, note);
  }
  const orderLines = [...merged.entries()].map(([menuItemId, quantity]) => ({
    menuItemId,
    quantity,
    note: lineNotes.get(menuItemId) ?? "",
  }));
  if (orderLines.length === 0) {
    return NextResponse.json({ error: "Add at least one meal." }, { status: 400 });
  }

  const slug = clean(body.businessSlug, 80);
  const business = slug ? getBusinessBySlug(slug) : getHomepageBusiness();
  if (!business) {
    return NextResponse.json({ error: "That menu is not available." }, { status: 400 });
  }

  let cardLast4 = "";
  let wallet = "";
  let stripePaymentIntentId = "";
  let quote;
  try {
    quote = priceOrderLines(business.id, orderLines);
  } catch (error) {
    if (error instanceof OrderError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }

  if (clean(body.payment, 20) === "zelle") {
    const zelle = zelleAccount(business.id);
    if (!zelle) {
      return NextResponse.json({ error: "Zelle is not set up on this menu." }, { status: 400 });
    }
    try {
      const saved = await recordZelleOrder(business.id, {
        customerName,
        phone,
        email,
        companyName,
        notes,
        smsOptIn: body.smsOptIn === true,
        cardLast4: "Zelle",
        delivery,
        lines: orderLines,
      });
      return NextResponse.json({
        orderNumber: saved.orderNumber,
        totalCents: saved.totalCents,
        customerName: saved.customerName,
        deliveryAddress: saved.deliveryAddress,
        deliveryLocateUrl: saved.deliveryLocateUrl,
        items: saved.items,
        last4: "Zelle",
        payment: "zelle",
        zelleName: zelle.name,
        zelleHandle: zelle.handle,
      });
    } catch (error) {
      if (error instanceof OrderError) return NextResponse.json({ error: error.message }, { status: 400 });
      console.error(error);
      return NextResponse.json({ error: "Could not record the order." }, { status: 500 });
    }
  }

  {
    const stripe = stripeSettings(business.id);
    if (!stripe.connected) {
      return NextResponse.json(
        { error: "Stripe is not connected, so the card was not charged." },
        { status: 400 },
      );
    }
    const metadata: Record<string, string> = {
      businessId: String(business.id),
      customerName,
      phone,
      email,
      companyName,
      notes: notes.replace(/\s+/g, " "),
      smsOptIn: body.smsOptIn === true ? "1" : "0",
      line1: delivery.line1,
      line2: delivery.line2,
      city: delivery.city,
      state: delivery.state,
      postalCode: delivery.postalCode,
      lines: orderLines.map((line) => `${line.menuItemId}:${line.quantity}`).join(","),
    };
    for (const line of orderLines) {
      if (line.note) metadata[`n${line.menuItemId}`] = line.note;
    }
    if (body.paymentIntentId) {
      const paid = await paidIntent(business.id, clean(body.paymentIntentId, 80));
      if (!paid.ok) return NextResponse.json({ error: paid.error }, { status: 400 });
      if (paid.metadata.businessId !== String(business.id) || paid.amountCents !== quote.totalCents) {
        return NextResponse.json(
          { error: "That payment does not match this order, so it was not recorded as paid." },
          { status: 400 },
        );
      }
      cardLast4 = paid.last4 || "CARD";
      wallet = paid.wallet;
      stripePaymentIntentId = paid.paymentIntentId;
    } else if (body.paymentMethodId) {
      const charged = await chargeCard({
        businessId: business.id,
        amountCents: quote.totalCents,
        paymentMethodId: clean(body.paymentMethodId, 80),
        metadata,
      });
      if (!charged.ok) return NextResponse.json({ error: charged.error }, { status: 400 });
      if (charged.status === "requires_action") {
        return NextResponse.json({
          requiresAction: true,
          clientSecret: charged.clientSecret,
          paymentIntentId: charged.paymentIntentId,
        });
      }
      cardLast4 = charged.last4 || "CARD";
      wallet = charged.wallet;
      stripePaymentIntentId = charged.paymentIntentId;
    } else {
      return NextResponse.json({ error: "The card was not charged." }, { status: 400 });
    }
  }

  try {
    const saved = await recordPaidOrder(business.id, {
      customerName,
      phone,
      email,
      companyName,
      notes,
      smsOptIn: body.smsOptIn === true,
      cardLast4,
      stripePaymentIntentId,
      delivery,
      lines: orderLines,
    });
    return NextResponse.json({
      orderNumber: saved.orderNumber,
      totalCents: saved.totalCents,
      customerName: saved.customerName,
      deliveryAddress: saved.deliveryAddress,
      deliveryLocateUrl: saved.deliveryLocateUrl,
      items: saved.items,
      last4: cardLast4,
      wallet,
    });
  } catch (error) {
    if (error instanceof OrderError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not record the order." }, { status: 500 });
  }
}
