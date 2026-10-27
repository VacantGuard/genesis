import Link from "next/link";
import { formatMoney, formatWhen } from "@/lib/format";
import type { CustomerOrder } from "@/lib/customer-auth";

export function CustomerDashboard({
  name,
  phone,
  orders,
  menuHref,
}: {
  name: string;
  phone: string;
  orders: CustomerOrder[];
  menuHref: string;
}) {
  return (
    <div className="mx-auto grid max-w-2xl gap-8 px-6 py-10">
      <div>
        <h1 className="text-4xl font-medium tracking-tight">{name}</h1>
        {phone ? <p className="mt-2 text-sm text-[#5c5e62]">{phone}</p> : null}
        <Link href={menuHref} className="mt-4 inline-flex text-sm font-medium underline">
          Back to the menu
        </Link>
      </div>

      <section aria-labelledby="your-orders">
        <h2 id="your-orders" className="text-2xl font-medium tracking-tight">
          Your orders
        </h2>
        {orders.length === 0 ? (
          <p className="mt-4 rounded bg-white p-4 text-sm leading-6 text-[#5c5e62]">
            {phone
              ? `No paid orders yet for ${phone}. An order shows here after you check out with this phone number.`
              : "No paid orders yet. Sign in with the phone number you use at checkout."}
          </p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {orders.map((order) => (
              <li key={order.orderNumber} className="bg-white p-4 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{order.orderNumber}</span>
                  <span>{formatMoney(order.totalCents)}</span>
                </div>
                <p className="mt-2 text-[#5c5e62]">{formatWhen(order.createdAt)}</p>
                {order.items ? <p className="mt-2 leading-6">{order.items}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
