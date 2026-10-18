import { NextResponse } from "next/server";
import { getBusinessBySlug, getHomepageBusiness, menuLink } from "@/lib/businesses";
import { getPublicMenu } from "@/lib/menu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug")?.trim() ?? "";
  const business = slug ? getBusinessBySlug(slug) : getHomepageBusiness();
  if (!business) {
    return NextResponse.json({ error: "That menu is not available." }, { status: 404 });
  }
  return NextResponse.json({
    business: business.name,
    slug: business.slug,
    menuUrl: menuLink(business.slug),
    menu: getPublicMenu(business.id),
  });
}
