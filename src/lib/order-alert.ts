import { postAgentWebhook } from "./agent.ts";
import { getBusiness } from "./businesses.ts";
import { formatMoney } from "./format.ts";
import { placeOrder } from "./orders.ts";
import type { NewOrderInput } from "./db.ts";

type AlertItem = { name: string; quantity: number; note: string };

export function orderSlackSummary(input: {
  businessName: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  items: AlertItem[];
  totalCents: number;
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
  const drop = input.deliveryAddress ? ` to ${input.deliveryAddress}` : "";
  const payment = input.paymentNote ? ` ${input.paymentNote}` : "";
  return `${input.businessName} has a new order ${input.orderNumber}. ${input.customerName}, ${input.phone}. Delivery${drop}. ${items}. Total ${formatMoney(input.totalCents)}.${payment}`;
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
    deliveryAddress: order.deliveryAddress,
    paymentNote: order.paymentNote,
  });
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
    deliveryAddress: order.deliveryAddress,
  });
  if (posted.delivery === "failed") console.error("Order Slack alert failed", posted.detail);
}

/** Records a paid order and posts one Slack alert. A repeat for the same Stripe payment does not post again. */
export async function recordPaidOrder(businessId: number, input: NewOrderInput) {
  const order = placeOrder(businessId, input);
  if (order.created) {
    try {
      await notifyNewOrder(businessId, {
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        phone: input.phone,
        items: order.items,
        totalCents: order.totalCents,
        deliveryAddress: order.deliveryAddress,
      });
    } catch (error) {
      console.error(error);
    }
  }
  return order;
}

/** Records a Zelle order that is not paid until staff confirm the transfer. */
export async function recordZelleOrder(businessId: number, input: NewOrderInput) {
  const order = placeOrder(businessId, { ...input, orderStatus: "zelle", cardLast4: "Zelle" });
  if (order.created) {
    try {
      await notifyNewOrder(businessId, {
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        phone: input.phone,
        items: order.items,
        totalCents: order.totalCents,
        deliveryAddress: order.deliveryAddress,
        paymentNote: "Payment is Zelle. Confirm the transfer before treating this order as paid.",
      });
    } catch (error) {
      console.error(error);
    }
  }
  return order;
}
