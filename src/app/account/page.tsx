import { redirect } from "next/navigation";
import { CustomerDashboard } from "@/components/customer-dashboard";
import { PublicFooter, PublicHeader, PublicPage } from "@/components/public-chrome";
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
    <PublicPage>
      <PublicHeader
        accountName={account.name}
        signOut={
          <form action={signOutAction}>
            <button type="submit" className="text-sm hover:text-[#fc968a]">
              Sign out
            </button>
          </form>
        }
      />
      <CustomerDashboard
        name={account.name}
        phone={account.phone}
        orders={ordersForCustomer(account)}
        menuHref={menuHref}
      />
      <PublicFooter />
    </PublicPage>
  );
}
