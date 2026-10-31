import { notFound } from "next/navigation";
import { PublicSite } from "@/components/public-site";
import { currentCustomer } from "@/lib/customer-auth";
import { getBusinessBySlug, getMenuWeekNote } from "@/lib/businesses";
import { getPublicMenu } from "@/lib/menu";
import { listReviews } from "@/lib/reviews";
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
      stripePublishableKey={stripePublishableKey(business.id)}
      zelle={zelleAccount(business.id)}
    />
  );
}
