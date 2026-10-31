import { PublicSite } from "@/components/public-site";
import { currentCustomer } from "@/lib/customer-auth";
import { getHomepageBusiness, getMenuWeekNote } from "@/lib/businesses";
import { getPublicMenu } from "@/lib/menu";
import { listReviews } from "@/lib/reviews";
import { deliveryChoices } from "@/lib/delivery-dates";
import { stripePublishableKey } from "@/lib/stripe";
import { zelleAccount } from "@/lib/zelle";

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
      profile={{ name: business.name, about: business.about, weekNote: getMenuWeekNote(business.id) }}
      menu={menu}
      reviews={listReviews(business.id)}
      businessSlug={business.slug}
      accountName={account?.name ?? null}
      stripePublishableKey={stripePublishableKey(business.id)}
      zelle={zelleAccount(business.id)}
      deliveryChoices={deliveryChoices()}
    />
  );
}
