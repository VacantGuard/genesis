import { NextResponse } from "next/server";
import { OrderError, placeOrder } from "@/lib/db";
import { readDeliveryAddress, validateDeliveryAddress } from "@/lib/delivery";
import { validateMockCard } from "@/lib/payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  customerName?: string;
  phone?: string;
  email?: string;
  companyName?: string;
  notes?: string;
  delivery?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
  card?: { number?: string; expiry?: string; cvc?: string; name?: string };
  lines?: { menuItemId?: number; quantity?: number }[];
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
  for (const line of lines) {
    const menuItemId = Number(line.menuItemId);
    const quantity = Number(line.quantity);
    if (!Number.isInteger(menuItemId) || !Number.isInteger(quantity)) continue;
    merged.set(menuItemId, (merged.get(menuItemId) ?? 0) + quantity);
  }
  if (merged.size === 0) {
    return NextResponse.json({ error: "Add at least one meal." }, { status: 400 });
  }

  const card = validateMockCard({
    number: clean(body.card?.number, 24),
    expiry: clean(body.card?.expiry, 7),
    cvc: clean(body.card?.cvc, 4),
    name: clean(body.card?.name, 80),
  });
  if (!card.ok) {
    return NextResponse.json({ error: card.error }, { status: 400 });
  }

  try {
    const order = placeOrder({
      customerName,
      phone,
      email,
      companyName,
      notes,
      cardLast4: card.last4,
      delivery,
      lines: [...merged.entries()].map(([menuItemId, quantity]) => ({ menuItemId, quantity })),
    });
    return NextResponse.json(order);
  } catch (error) {
    if (error instanceof OrderError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not record the order." }, { status: 500 });
  }
}
