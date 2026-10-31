import { NextResponse } from "next/server";
import { getBusinessBySlug, getHomepageBusiness } from "@/lib/businesses";
import { OrderError } from "@/lib/db";
import { readDeliveryAddress, validateDeliveryAddress } from "@/lib/delivery";
import { deliveryDateError } from "@/lib/delivery-dates";
import { cleanLineNote, priceOrderLines } from "@/lib/orders";
import { ensureApplePayDomains, openCheckout } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  businessSlug?: string;
  paymentIntentId?: string;
  customerName?: string;
  phone?: string;
  email?: string;
  companyName?: string;
  notes?: string;
  smsOptIn?: boolean;
  deliveryDate?: string;
  delivery?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
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

  const customerName = clean(body.customerName, 80);
  const phone = clean(body.phone, 40);
  const email = clean(body.email, 120);
  const delivery = readDeliveryAddress(body.delivery ?? {});
  if (customerName || phone || email || delivery.line1) {
    if (customerName.length < 2) {
      return NextResponse.json({ error: "Enter the name for the ticket." }, { status: 400 });
    }
    if (phone.replace(/\D/g, "").length < 7) {
      return NextResponse.json({ error: "Enter a phone number for the ticket." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter an email for the receipt." }, { status: 400 });
    }
    const deliveryError = validateDeliveryAddress(delivery);
    if (deliveryError) return NextResponse.json({ error: deliveryError }, { status: 400 });
    const dateError = deliveryDateError(clean(body.deliveryDate, 10));
    if (dateError) return NextResponse.json({ error: dateError }, { status: 400 });
  }

  let quote;
  try {
    quote = priceOrderLines(business.id, orderLines);
  } catch (error) {
    if (error instanceof OrderError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }

  const metadata: Record<string, string> = {
    businessId: String(business.id),
    customerName,
    phone,
    email,
    companyName: clean(body.companyName, 80),
    notes: clean(body.notes, 400).replace(/\s+/g, " "),
    smsOptIn: body.smsOptIn === true ? "1" : "0",
    line1: delivery.line1,
    line2: delivery.line2,
    city: delivery.city,
    state: delivery.state,
    postalCode: delivery.postalCode,
    deliveryDate: clean(body.deliveryDate, 10),
    lines: orderLines.map((line) => `${line.menuItemId}:${line.quantity}`).join(","),
  };
  for (const line of orderLines) {
    if (line.note) metadata[`n${line.menuItemId}`] = line.note;
  }

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  await ensureApplePayDomains(business.id, [host, "tigeats.com", "www.tigeats.com"]);

  const opened = await openCheckout({
    businessId: business.id,
    amountCents: quote.totalCents,
    paymentIntentId: clean(body.paymentIntentId, 80),
    metadata,
  });
  if (!opened.ok) return NextResponse.json({ error: opened.error }, { status: 400 });
  return NextResponse.json({
    paymentIntentId: opened.paymentIntentId,
    clientSecret: opened.clientSecret,
    totalCents: quote.totalCents,
  });
}
