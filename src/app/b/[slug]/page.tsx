import { notFound } from "next/navigation";
import { PublicSite } from "@/components/public-site";
import { getBusinessBySlug } from "@/lib/businesses";
import { getPublicMenu } from "@/lib/menu";

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
  return (
    <PublicSite
      profile={{ name: business.name, about: business.about }}
      menu={menu}
      businessSlug={business.slug}
    />
  );
}
