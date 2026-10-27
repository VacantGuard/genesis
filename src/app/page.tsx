import { PublicSite } from "@/components/public-site";
import { currentCustomer } from "@/lib/customer-auth";
import { getHomepageBusiness } from "@/lib/businesses";
import { getPublicMenu } from "@/lib/menu";
import { stripePublishableKey } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function generateMetadata() {
  const business = getHomepageBusiness();
  return {
    title: business.name,
    description: business.about.slice(0, 160),
  };
}

export default async function HomePage() {
  const business = getHomepageBusiness();
  const menu = getPublicMenu(business.id);
  const account = await currentCustomer();
  return (
    <PublicSite
      profile={{ name: business.name, about: business.about }}
      menu={menu}
      businessSlug={business.slug}
      accountName={account?.name ?? null}
      stripePublishableKey={stripePublishableKey(business.id)}
    />
  );
}
