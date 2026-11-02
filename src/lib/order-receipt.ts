import { formatDeliveryDate } from "./delivery-dates.ts";
import { formatMoney } from "./format.ts";
import { sendMail } from "./mail.ts";

type ReceiptItem = { name: string; quantity: number; unitPriceCents: number; note?: string };

export type OrderReceiptInput = {
  businessName: string;
  to: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  companyName?: string;
  notes?: string;
  items: ReceiptItem[];
  totalCents: number;
  deliveryDate?: string;
  deliveryAddress?: string;
  payment: "paid" | "zelle";
  cardLast4?: string;
  zelle?: { name: string; handle: string } | null;
};

function oneLine(value: string | undefined) {
  return (value ?? "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

function paymentParagraph(input: OrderReceiptInput) {
  if (input.payment === "zelle") {
    const handle = oneLine(input.zelle?.handle);
    const name = oneLine(input.zelle?.name);
    if (handle) {
      const who = name ? `${name} at ${handle}` : handle;
      return `Send ${formatMoney(input.totalCents)} with Zelle to ${who}. Put your name in the Zelle note. The kitchen confirms the transfer before this order is paid.`;
    }
    return "Pay this order with Zelle. The kitchen confirms the transfer before it is paid.";
  }
  const last4 = oneLine(input.cardLast4);
  if (/^\d{4}$/.test(last4)) return `This order is paid. Card ending ${last4}.`;
  return "This order is paid.";
}

export function orderReceiptMessage(input: OrderReceiptInput) {
  const businessName = oneLine(input.businessName) || "TigEats";
  const orderNumber = oneLine(input.orderNumber);
  const customerName = oneLine(input.customerName) || "there";
  const items = input.items
    .map((item) => {
      const line = `${item.quantity} × ${oneLine(item.name)} — ${formatMoney(item.unitPriceCents * item.quantity)}`;
      const note = oneLine(item.note);
      return note ? `${line}\n  ${note}` : line;
    })
    .join("\n");
  const when = formatDeliveryDate(input.deliveryDate ?? "");
  const address = oneLine(input.deliveryAddress);
  const company = oneLine(input.companyName);
  const notes = oneLine(input.notes);
  const details = [
    when ? `Delivery: ${when}` : "",
    address ? address : "",
    company ? `Company: ${company}` : "",
    input.phone.trim() ? `Phone: ${oneLine(input.phone)}` : "",
    notes ? `Note: ${notes}` : "",
  ].filter(Boolean);
  const text = [
    `${customerName}, this is your ${businessName} receipt for ${orderNumber}.`,
    "",
    items,
    "",
    `Total ${formatMoney(input.totalCents)}`,
    "",
    details.join("\n"),
    "",
    paymentParagraph(input),
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return {
    to: input.to.trim(),
    subject: `${businessName} receipt ${orderNumber}`.replace(/[\r\n]+/g, " ").slice(0, 180),
    text: `${text}\n`,
  };
}

export async function sendOrderReceipt(input: OrderReceiptInput) {
  const sent = await sendMail(orderReceiptMessage(input), { logName: "last-order-receipt.txt" });
  if (!sent.ok) {
    console.error("Order receipt email failed", sent.error);
    return false;
  }
  return sent.mode === "sent";
}
