import { markZelleReceivedAction } from "@/lib/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { currentBusiness } from "@/lib/current-business";
import { formatDeliveryDate } from "@/lib/delivery-dates";
import { formatMoney, formatWhen } from "@/lib/format";
import { listOrders } from "@/lib/orders";

export default async function OrdersPage() {
  const business = await currentBusiness();
  const orders = listOrders(business.id);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl tracking-tight">Orders</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Card and Apple Pay orders are paid through Stripe. A Zelle order stays unpaid until the transfer is marked received.
          </p>
        </div>
        <a href="/terminal/orders/export" className={buttonVariants({ variant: "outline" })}>
          Export CSV
        </a>
      </div>

      {orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No orders yet. Place one from the public menu.
        </p>
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => (
            <article key={order.id} className="grid gap-3 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-heading text-2xl tracking-tight">{order.orderNumber}</h2>
                <p className="text-sm text-muted-foreground">{formatWhen(order.createdAt)}</p>
              </div>
              <p className="text-sm">
                {order.customerName}
                {order.companyName ? ` · ${order.companyName}` : ""} · {order.phone} · {order.email}
              </p>
              {order.deliveryDate ? (
                <p className="text-sm">Delivery {formatDeliveryDate(order.deliveryDate)}</p>
              ) : null}
              {order.deliveryAddress ? (
                <p className="text-sm">
                  Deliver to {order.deliveryAddress}
                  {order.deliveryLocateUrl ? (
                    <>
                      {" · "}
                      <a
                        href={order.deliveryLocateUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        Locate
                      </a>
                    </>
                  ) : null}
                </p>
              ) : null}
              <p className="text-sm text-muted-foreground">
                {order.cardLast4 === "Zelle" && order.status === "zelle"
                  ? "Zelle — waiting for the transfer"
                  : order.cardLast4 === "Zelle"
                    ? "Zelle received"
                    : `Card ending ${order.cardLast4}`}
              </p>
              {order.cardLast4 === "Zelle" && order.status === "zelle" ? (
                <form action={markZelleReceivedAction}>
                  <input type="hidden" name="id" value={order.id} />
                  <Button type="submit" size="sm" variant="outline">
                    Mark Zelle received
                  </Button>
                </form>
              ) : null}
              {order.notes ? <p className="text-sm">Notes: {order.notes}</p> : null}
              <ul className="grid gap-2 text-sm">
                {order.items.map((item, index) => (
                  <li key={`${order.id}-${index}`} className="flex justify-between gap-3">
                    <span>
                      {item.quantity} × {item.name}
                      {item.note ? <span className="block text-muted-foreground">{item.note}</span> : null}
                    </span>
                    <span>{formatMoney(item.unitPriceCents * item.quantity)}</span>
                  </li>
                ))}
              </ul>
              <p className="font-medium">{formatMoney(order.totalCents)}</p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
