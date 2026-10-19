import { buttonVariants } from "@/components/ui/button";
import { currentBusiness } from "@/lib/current-business";
import { formatMoney, formatWhen } from "@/lib/format";
import { listOrders } from "@/lib/orders";

export default async function OrdersPage() {
  const business = await currentBusiness();
  const orders = listOrders(business.id);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl tracking-tight">Paid orders</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Meal orders recorded by the practice checkout. Export a CSV for the kitchen.
          </p>
        </div>
        <a href="/terminal/orders/export" className={buttonVariants({ variant: "outline" })}>
          Export CSV
        </a>
      </div>

      {orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No paid orders yet. Place one from the public POS section.
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
              <p className="text-sm text-muted-foreground">Card ending {order.cardLast4}</p>
              {order.notes ? <p className="text-sm">Notes: {order.notes}</p> : null}
              <ul className="grid gap-1 text-sm">
                {order.items.map((item) => (
                  <li key={`${order.id}-${item.name}`} className="flex justify-between gap-3">
                    <span>
                      {item.quantity} × {item.name}
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
