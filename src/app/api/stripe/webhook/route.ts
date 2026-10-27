import { NextResponse } from "next/server";
import { OrderError } from "@/lib/db";
import { readDeliveryAddress } from "@/lib/delivery";
import { placeOrder, priceOrderLines } from "@/lib/orders";
import { businessIdForWebhook, paidIntent } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function linesFrom(value: string) {
  const merged = new Map<number, number>();
  for (const part of value.split(",")) {
    const [rawId, rawQuantity] = part.split(":");
    const menuItemId = Number(rawId);
    const quantity = Number(rawQuantity);
    if (!Number.isInteger(menuItemId) || !Number.isInteger(quantity)) continue;
    merged.set(menuItemId, (merged.get(menuItemId) ?? 0) + quantity);
  }
  return [...merged.entries()].map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
}

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") || "";
  const businessId = businessIdForWebhook(payload, signature);
  if (!businessId) {
    return NextResponse.json({ error: "That Stripe signature does not match a saved webhook secret." }, { status: 400 });
  }

  let event: { type?: string; data?: { object?: { id?: string } } };
  try {
    event = JSON.parse(payload) as { type?: string; data?: { object?: { id?: string } } };
  } catch {
    return NextResponse.json({ error: "The Stripe event could not be read." }, { status: 400 });
  }
  if (event.type !== "payment_intent.succeeded") return NextResponse.json({ received: true });

  const paymentIntentId = event.data?.object?.id || "";
  const paid = await paidIntent(businessId, paymentIntentId);
  if (!paid.ok || paid.metadata.businessId !== String(businessId)) return NextResponse.json({ received: true });

  const lines = linesFrom(paid.metadata.lines || "");
  if (lines.length === 0) return NextResponse.json({ received: true });
  try {
    const quote = priceOrderLines(businessId, lines);
    if (quote.totalCents !== paid.amountCents) return NextResponse.json({ received: true });
    const delivery = readDeliveryAddress({
      line1: paid.metadata.line1,
      line2: paid.metadata.line2,
      city: paid.metadata.city,
      state: paid.metadata.state,
      postalCode: paid.metadata.postalCode,
    });
    placeOrder(businessId, {
      customerName: paid.metadata.customerName || "Customer",
      phone: paid.metadata.phone || "",
      email: paid.metadata.email || "",
      companyName: paid.metadata.companyName || "",
      notes: paid.metadata.notes || "",
      smsOptIn: paid.metadata.smsOptIn === "1",
      cardLast4: paid.last4 || "CARD",
      stripePaymentIntentId: paid.paymentIntentId,
      delivery,
      lines,
    });
  } catch (error) {
    if (error instanceof OrderError) return NextResponse.json({ received: true });
    console.error(error);
    return NextResponse.json({ error: "The paid order could not be recorded." }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
