import Link from "next/link";
import { CustomerProfileForm } from "@/components/customer-profile-form";
import { formatDeliveryDate } from "@/lib/delivery-dates";
import { formatMoney, formatWhen } from "@/lib/format";
import type { CheckoutDetails, CustomerOrder } from "@/lib/customer-auth";

function savedAddress(profile: CheckoutDetails) {
  const street = [profile.line1, profile.line2].filter(Boolean).join(", ");
  const region = [profile.state, profile.postalCode].filter(Boolean).join(" ");
  const cityLine = [profile.city, region].filter(Boolean).join(", ");
  return [street, cityLine].filter(Boolean).join(", ");
}

export function CustomerDashboard({
  name,
  phone,
  orders,
  menuHref,
  profile,
  clientNumber,
  saved,
}: {
  name: string;
  phone: string;
  orders: CustomerOrder[];
  menuHref: string;
  profile: CheckoutDetails | null;
  clientNumber?: string;
  saved?: boolean;
}) {
  const address = profile ? savedAddress(profile) : "";

  return (
    <div className="mx-auto grid max-w-2xl gap-8 px-6 py-10">
      <div>
        <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">{name}</h1>
        {phone ? <p className="mt-2 text-sm text-[#5d7568]">{phone}</p> : null}
        {clientNumber ? <p className="mt-1 text-sm text-[#5d7568]">Client {clientNumber}</p> : null}
        <Link href={menuHref} className="mt-4 inline-flex text-sm font-medium underline">
          Back to the menu
        </Link>
      </div>

      <section aria-labelledby="your-profile">
        <h2 id="your-profile" className="font-serif text-3xl tracking-tight">
          Your profile
        </h2>
        {profile ? (
          <>
            <p className="mt-4 text-sm leading-6 text-[#5d7568]">
              {address ? `Delivery address: ${address}` : "No delivery address saved yet."} Checkout on the menu
              uses these details. Change anything here, then save.
            </p>
            {saved ? <p className="mt-3 text-sm font-medium text-[#496252]">Profile saved.</p> : null}
            <div className="mt-4 rounded-2xl bg-white p-4">
              <CustomerProfileForm profile={profile} />
            </div>
          </>
        ) : (
          <p className="mt-4 rounded-2xl bg-white p-4 text-sm leading-6 text-[#5d7568]">
            Sign in with your account to see and edit your saved details.
          </p>
        )}
      </section>

      <section aria-labelledby="your-orders">
        <h2 id="your-orders" className="font-serif text-3xl tracking-tight">
          Your orders
        </h2>
        {orders.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-white p-4 text-sm leading-6 text-[#5d7568]">
            {phone
              ? `No paid orders yet for ${phone}. An order shows here after you check out with this phone number.`
              : "No paid orders yet. Sign in with the phone number you use at checkout."}
          </p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {orders.map((order) => (
              <li key={order.orderNumber} className="rounded-2xl bg-white p-4 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{order.orderNumber}</span>
                  <span>{formatMoney(order.totalCents)}</span>
                </div>
                <p className="mt-2 text-[#5d7568]">{formatWhen(order.createdAt)}</p>
                {order.deliveryDate ? (
                  <p className="mt-1">Delivery {formatDeliveryDate(order.deliveryDate)}</p>
                ) : null}
                {order.items ? <p className="mt-2 leading-6">{order.items}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
