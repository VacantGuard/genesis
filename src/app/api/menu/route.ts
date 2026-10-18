import { NextResponse } from "next/server";
import { listTriggers } from "@/lib/agent";
import { getBusinessBySlug, getHomepageBusiness, menuLink } from "@/lib/businesses";
import { publicOrigin } from "@/lib/menu-memory";
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
    menuUrl: menuLink(business.slug, publicOrigin(request)),
    recentChanges: listTriggers(business.id).map((change) => ({
      summary: change.summary,
      createdAt: change.createdAt,
    })),
    menu: getPublicMenu(business.id),
  });
}
