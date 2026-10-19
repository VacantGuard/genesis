import Link from "next/link";
import { redirect } from "next/navigation";
import { CustomerDashboard } from "@/components/customer-dashboard";
import { signOutAction } from "@/lib/customer-actions";
import { currentCustomer, ordersForCustomer } from "@/lib/customer-auth";
import { getHomepageBusiness } from "@/lib/businesses";
import { getCustomer } from "@/lib/directory";
import { getPublicMenu } from "@/lib/menu";

export const metadata = { title: "Customer dashboard" };

export default async function AccountPage() {
  const account = await currentCustomer();
  if (!account) redirect("/account/login");
  const business = getHomepageBusiness();
  const menuBusinessId = account.businessId || business.id;
  const menu = getPublicMenu(menuBusinessId);
  const clientNumber = account.customerId ? getCustomer(menuBusinessId, account.customerId)?.clientNumber ?? "" : "";

  return (
    <main className="min-h-screen bg-[#f4f4f4] text-[#171a20]">
      <header className="bg-[#171a20] text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="text-sm font-medium">
            {business.name}
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <a href="#menu" className="text-white/80">
              Menu
            </a>
            <a href="#orders" className="text-white/80">
              Orders
            </a>
            <form action={signOutAction}>
              <button type="submit" className="text-white/80">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <CustomerDashboard
        businessName={business.name}
        clientNumber={clientNumber}
        guest={account.id === 0}
        accountLabel={account.id === 0 ? "" : `${account.email} · ${account.phone}`}
        menu={menu}
        orders={ordersForCustomer(account)}
      />
    </main>
  );
}
