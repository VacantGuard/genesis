import Link from "next/link";
import { notFound } from "next/navigation";
import { currentBusiness } from "@/lib/current-business";
import { ordersForCustomerRecord } from "@/lib/customer-orders";
import { getCustomer } from "@/lib/directory";
import { formatDeliveryDate } from "@/lib/delivery-dates";
import { formatMoney, formatWhen } from "@/lib/format";

export default async function CustomerOrdersPage({ params }: { params: Promise<{ id: string }> }) {
  const business = await currentBusiness();
  const customer = getCustomer(business.id, Number((await params).id));
  if (!customer) notFound();
  const orders = ordersForCustomerRecord(business.id, customer);

  return (
    <>
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/terminal/customers" className="underline">
            Customers
          </Link>
        </p>
        <h1 className="font-heading mt-2 text-3xl tracking-tight">{customer.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Client {customer.clientNumber}
          {customer.phone ? ` · ${customer.phone}` : ""}
          {customer.email ? ` · ${customer.email}` : ""}
          {customer.companyName ? ` · ${customer.companyName}` : ""}
        </p>
      </div>
      <section className="grid gap-3">
        <h2 className="font-heading text-2xl tracking-tight">Previous orders</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No paid orders are linked to {customer.clientNumber} yet. A checkout with this phone or email shows up here and on their customer account.
          </p>
        ) : (
          orders.map((order) => (
            <article key={order.id} className="grid gap-2 rounded-xl border bg-card p-4 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-heading text-xl tracking-tight">{order.orderNumber}</h3>
                <p className="text-muted-foreground">{formatWhen(order.createdAt)}</p>
              </div>
              <ul className="grid gap-2">
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
              {order.deliveryDate ? (
                <p>Delivery {formatDeliveryDate(order.deliveryDate)}</p>
              ) : null}
              <p className="font-medium">{formatMoney(order.totalCents)}</p>
              {order.notes ? <p className="text-muted-foreground">Notes: {order.notes}</p> : null}
            </article>
          ))
        )}
      </section>
    </>
  );
}
