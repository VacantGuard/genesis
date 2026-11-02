import { LaunchAnticipation } from "@/components/launch-anticipation";
import { PublicSite } from "@/components/public-site";
import { currentCustomer } from "@/lib/customer-auth";
import { getHomepageBusiness, getMenuWeekNote } from "@/lib/businesses";
import { deskIsOpen } from "@/lib/go-live";
import { getPublicMenu } from "@/lib/menu";
import { listReviews } from "@/lib/reviews";
import { deliveryChoices } from "@/lib/delivery-dates";
import { stripePublishableKey } from "@/lib/stripe";
import { zelleAccount } from "@/lib/zelle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function generateMetadata() {
  if (!deskIsOpen()) {
    return { title: "TigEats", description: "The site will go live Tuesday at 11:00am Central." };
  }
  const business = getHomepageBusiness();
  return {
    title: business.name,
    description: business.about.slice(0, 160),
  };
}

export default async function HomePage() {
  if (!deskIsOpen()) return <LaunchAnticipation />;
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
