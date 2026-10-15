import { PublicSite } from "@/components/public-site";
import { getProfile, getPublicMenu } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function generateMetadata() {
  const profile = getProfile();
  return {
    title: profile.name,
    description: profile.about.slice(0, 160),
  };
}

export default function HomePage() {
  const profile = getProfile();
  const menu = getPublicMenu();
  return <PublicSite profile={profile} menu={menu} />;
}
