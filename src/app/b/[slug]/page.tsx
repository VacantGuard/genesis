import { notFound } from "next/navigation";
import { LaunchAnticipation } from "@/components/launch-anticipation";
import { PublicSite } from "@/components/public-site";
import { checkoutDetails, currentCustomer } from "@/lib/customer-auth";
import { getBusinessBySlug, getMenuWeekNote } from "@/lib/businesses";
import { getPublicMenu } from "@/lib/menu";
import { listReviews } from "@/lib/reviews";
import { deliveryChoices } from "@/lib/delivery-dates";
import { visitorSeesMenu } from "@/lib/go-live";
import { stripePublishableKey } from "@/lib/stripe";
import { zelleAccount } from "@/lib/zelle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = getBusinessBySlug(slug);
  if (!business) return { title: "Menu" };
  return {
    title: business.name,
    description: business.about.slice(0, 160),
  };
}

export default async function BusinessMenuPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!(await visitorSeesMenu())) return <LaunchAnticipation />;
  const { slug } = await params;
  const business = getBusinessBySlug(slug);
  if (!business) notFound();
  const menu = getPublicMenu(business.id);
  const account = await currentCustomer();
  return (
    <PublicSite
      profile={{ name: business.name, about: business.about, weekNote: getMenuWeekNote(business.id) }}
      menu={menu}
      reviews={listReviews(business.id)}
      businessSlug={business.slug}
      accountName={account && account.businessId === business.id ? account.name : null}
      checkout={checkoutDetails(account, business.id)}
      stripePublishableKey={stripePublishableKey(business.id)}
      canPayWithZelle={Boolean(zelleAccount(business.id))}
      deliveryChoices={deliveryChoices()}
    />
  );
}
