import { addDriverAction, markZelleReceivedAction, removeDriverAction, saveRouteStartAction } from "@/lib/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { currentBusiness } from "@/lib/current-business";
import { formatDeliveryDate } from "@/lib/delivery-dates";
import { listDrivers, routeStartAddress } from "@/lib/driver-route";
import { formatMoney, formatWhen } from "@/lib/format";
import { listOrders } from "@/lib/orders";

export default async function OrdersPage() {
  const business = await currentBusiness();
  const orders = listOrders(business.id);
  const drivers = listDrivers(business.id);
  const start = routeStartAddress(business.id);

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
      <section className="grid max-w-2xl gap-3 rounded-xl border bg-card p-4">
        <div>
          <h2 className="font-heading text-2xl tracking-tight">Drivers</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask the agent in Slack for a delivery date and it texts these numbers the stops, in ZIP order, with a
            Google Maps route. Card and Zelle orders for that date are included.
          </p>
        </div>
        <form action={saveRouteStartAction} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Map start</span>
            <Input
              name="start"
              defaultValue={start}
              placeholder="Kitchen address, optional"
              className="h-10 bg-background"
            />
          </label>
          <Button type="submit" variant="outline">
            Save start
          </Button>
        </form>
        {drivers.length > 0 ? (
          <ul className="grid gap-2 text-sm">
            {drivers.map((driver) => (
              <li key={driver.id} className="flex items-center justify-between gap-3">
                <span>
                  {driver.name} · {driver.phone}
                </span>
                <form action={removeDriverAction}>
                  <input type="hidden" name="id" value={driver.id} />
                  <Button type="submit" size="sm" variant="outline">
                    Remove
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No drivers yet.</p>
        )}
        <form action={addDriverAction} className="grid gap-2 sm:grid-cols-2">
          <Input name="name" placeholder="Driver name" required className="h-10 bg-background" />
          <Input name="phone" placeholder="Mobile number" required className="h-10 bg-background" />
          <div>
            <Button type="submit">Add driver</Button>
          </div>
        </form>
      </section>

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
