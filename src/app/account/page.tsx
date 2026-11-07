import { redirect } from "next/navigation";
import { CustomerDashboard } from "@/components/customer-dashboard";
import { PublicFooter, PublicHeader, PublicPage } from "@/components/public-chrome";
import { signOutAction } from "@/lib/customer-actions";
import { checkoutDetails, currentCustomer, ordersForCustomer } from "@/lib/customer-auth";
import { getCustomer } from "@/lib/directory";
import { getHomepageBusiness } from "@/lib/businesses";

export const metadata = { title: "Your orders" };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const account = await currentCustomer();
  if (!account) redirect("/account/login");
  const query = await searchParams;
  const business = getHomepageBusiness();
  const menuHref = business.slug ? `/b/${business.slug}` : "/";
  const profile = checkoutDetails(account, account.businessId);
  const customer = profile ? getCustomer(account.businessId, account.customerId) : null;

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
        name={profile?.name || account.name}
        phone={profile?.phone || account.phone}
        orders={ordersForCustomer(account)}
        menuHref={menuHref}
        profile={profile}
        clientNumber={customer?.clientNumber}
        saved={query.saved === "1"}
      />
      <PublicFooter />
    </PublicPage>
  );
}
