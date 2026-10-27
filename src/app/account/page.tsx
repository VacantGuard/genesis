import Link from "next/link";
import { redirect } from "next/navigation";
import { CustomerDashboard } from "@/components/customer-dashboard";
import { signOutAction } from "@/lib/customer-actions";
import { currentCustomer, ordersForCustomer } from "@/lib/customer-auth";
import { getHomepageBusiness } from "@/lib/businesses";

export const metadata = { title: "Your orders" };

export default async function AccountPage() {
  const account = await currentCustomer();
  if (!account) redirect("/account/login");
  const business = getHomepageBusiness();
  const menuHref = business.slug ? `/b/${business.slug}` : "/";

  return (
    <main className="min-h-screen bg-[#f4f4f4] text-[#171a20]">
      <header className="bg-[#171a20] text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href={menuHref} className="text-sm font-medium">
            {business.name}
          </Link>
          <form action={signOutAction}>
            <button type="submit" className="text-sm text-white/80">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <CustomerDashboard
        name={account.name}
        phone={account.phone}
        orders={ordersForCustomer(account)}
        menuHref={menuHref}
      />
    </main>
  );
}
