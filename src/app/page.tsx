import { PublicSite } from "@/components/public-site";
import { getHomepageBusiness } from "@/lib/businesses";
import { getPublicMenu } from "@/lib/menu";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function generateMetadata() {
  const business = getHomepageBusiness();
  return {
    title: business.name,
    description: business.about.slice(0, 160),
  };
}

export default function HomePage() {
  const business = getHomepageBusiness();
  const menu = getPublicMenu(business.id);
  return (
    <PublicSite
      profile={{ name: business.name, about: business.about }}
      menu={menu}
      businessSlug={business.slug}
    />
  );
}
