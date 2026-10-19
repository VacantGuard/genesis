import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutAction } from "@/lib/customer-actions";
import { currentCustomer, ordersForCustomer } from "@/lib/customer-auth";
import { formatMoney, formatWhen } from "@/lib/format";
import { getHomepageBusiness } from "@/lib/businesses";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const account = await currentCustomer();
  if (!account) redirect("/account/login");
  const business = getHomepageBusiness();
  const orders = ordersForCustomer(account);

  return (
    <main className="min-h-screen bg-white text-[#171a20]">
      <header className="bg-[#171a20] text-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <Link href="/" className="text-sm font-medium">
            {business.name}
          </Link>
          <form action={signOutAction}>
            <button type="submit" className="text-sm text-white/80">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-4xl font-medium tracking-tight">
          {account.id === 0 ? "Customer dashboard" : account.name}
        </h1>
        {account.id === 0 ? (
          <p className="mt-2 text-sm text-[#5c5e62]">
            Sign-in is temporarily skipped. Orders appear here after you check out with a phone number on an account.
          </p>
        ) : (
          <p className="mt-2 text-sm text-[#5c5e62]">
            {account.email} · {account.phone}
          </p>
        )}
        <h2 className="mt-12 text-2xl font-medium tracking-tight">Orders</h2>
        {orders.length === 0 ? (
          <p className="mt-4 text-sm text-[#5c5e62]">
            No paid orders yet for this phone number.{" "}
            <Link href="/#pos" className="underline">
              Order this week
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-4 divide-y border-y border-black/10">
            {orders.map((order) => (
              <li key={order.orderNumber} className="grid gap-1 py-4 text-sm sm:grid-cols-[8rem_1fr_auto]">
                <span className="font-medium">{order.orderNumber}</span>
                <span className="text-[#5c5e62]">
                  {formatWhen(order.createdAt)}
                  {order.items ? ` · ${order.items}` : ""}
                </span>
                <span>
                  {formatMoney(order.totalCents)} · {order.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
