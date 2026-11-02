import { postAgentWebhook } from "./agent.ts";
import { getBusiness } from "./businesses.ts";
import { formatDeliveryDate } from "./delivery-dates.ts";
import { formatMoney } from "./format.ts";
import { sendOrderReceipt } from "./order-receipt.ts";
import { placeOrder } from "./orders.ts";
import { postBusinessSlack } from "./slack-post.ts";
import { zelleAccount } from "./zelle.ts";
import type { NewOrderInput } from "./db.ts";

type AlertItem = { name: string; quantity: number; note: string };

export function orderSlackSummary(input: {
  businessName: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  items: AlertItem[];
  totalCents: number;
  deliveryDate?: string;
  deliveryAddress: string;
  paymentNote?: string;
}) {
  const items = input.items
    .map((item) => {
      const note = item.note.trim();
      const label = `${item.quantity} × ${item.name}`;
      return note ? `${label} (${note})` : label;
    })
    .join(", ");
  const when = input.deliveryDate ? formatDeliveryDate(input.deliveryDate) : "";
  const drop = input.deliveryAddress ? ` to ${input.deliveryAddress}` : "";
  const payment = input.paymentNote ? ` ${input.paymentNote}` : "";
  const schedule = when ? ` ${when}` : "";
  return `${input.businessName} has a new order ${input.orderNumber}. ${input.customerName}, ${input.phone}. Delivery${schedule}${drop}. ${items}. Total ${formatMoney(input.totalCents)}.${payment}`;
}

async function notifyNewOrder(
  businessId: number,
  order: {
    id: number;
    orderNumber: string;
    customerName: string;
    phone: string;
    items: AlertItem[];
    totalCents: number;
    deliveryDate?: string;
    deliveryAddress: string;
    paymentNote?: string;
  },
) {
  const business = getBusiness(businessId);
  if (!business) return;
  const summary = orderSlackSummary({
    businessName: business.name,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    phone: order.phone,
    items: order.items,
    totalCents: order.totalCents,
    deliveryDate: order.deliveryDate,
    deliveryAddress: order.deliveryAddress,
    paymentNote: order.paymentNote,
  });
  const slack = await postBusinessSlack(business.id, "orders", summary);
  if (slack.configured) {
    if (!slack.ok) console.error("Order Slack alert failed", slack.detail);
    return;
  }
  const posted = await postAgentWebhook(business.id, {
    event: "order.created",
    business: business.name,
    slug: business.slug,
    slackTeamId: business.slackTeamId,
    summary,
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    phone: order.phone,
    items: order.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      note: item.note,
    })),
    totalCents: order.totalCents,
    fulfillment: "Delivery",
    deliveryDate: order.deliveryDate || "",
    deliveryAddress: order.deliveryAddress,
  });
  if (posted.delivery === "failed") console.error("Order Slack alert failed", posted.detail);
}

function receiptFor(
  businessId: number,
  input: NewOrderInput,
  order: {
    orderNumber: string;
    customerName: string;
    items: { name: string; quantity: number; unitPriceCents: number; note?: string }[];
    totalCents: number;
    deliveryDate?: string;
    deliveryAddress: string;
  },
  payment: "paid" | "zelle",
) {
  const business = getBusiness(businessId);
  return sendOrderReceipt({
    businessName: business?.name || "TigEats",
    to: input.email,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    phone: input.phone,
    companyName: input.companyName,
    notes: input.notes,
    items: order.items,
    totalCents: order.totalCents,
    deliveryDate: order.deliveryDate,
    deliveryAddress: order.deliveryAddress,
    payment,
    cardLast4: input.cardLast4,
    zelle: payment === "zelle" ? zelleAccount(businessId) : null,
  });
}

/** Records a paid order and posts one Slack alert. A repeat for the same Stripe payment does not post again. */
export async function recordPaidOrder(businessId: number, input: NewOrderInput) {
  const order = placeOrder(businessId, input);
  let receiptSent = false;
  if (order.created) {
    try {
      await notifyNewOrder(businessId, {
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        phone: input.phone,
        items: order.items,
        totalCents: order.totalCents,
        deliveryDate: order.deliveryDate,
        deliveryAddress: order.deliveryAddress,
      });
    } catch (error) {
      console.error(error);
    }
    receiptSent = await receiptFor(businessId, input, order, "paid");
  }
  return { ...order, receiptSent };
}

/** Records a Zelle order that is not paid until staff confirm the transfer. */
export async function recordZelleOrder(businessId: number, input: NewOrderInput) {
  const order = placeOrder(businessId, { ...input, orderStatus: "zelle", cardLast4: "Zelle" });
  let receiptSent = false;
  if (order.created) {
    try {
      await notifyNewOrder(businessId, {
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        phone: input.phone,
        items: order.items,
        totalCents: order.totalCents,
        deliveryDate: order.deliveryDate,
        deliveryAddress: order.deliveryAddress,
        paymentNote: "Payment is Zelle. Confirm the transfer before treating this order as paid.",
      });
    } catch (error) {
      console.error(error);
    }
    receiptSent = await receiptFor(businessId, input, order, "zelle");
  }
  return { ...order, receiptSent };
}
