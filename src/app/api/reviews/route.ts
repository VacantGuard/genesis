import { NextResponse } from "next/server";
import { getBusinessBySlug, getHomepageBusiness } from "@/lib/businesses";
import { addReview } from "@/lib/reviews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { businessSlug?: string; author?: string; rating?: number; body?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "That review could not be read." }, { status: 400 });
  }
  const slug = String(body.businessSlug ?? "").trim();
  const business = slug ? getBusinessBySlug(slug) : getHomepageBusiness();
  if (!business) return NextResponse.json({ error: "That menu is not available." }, { status: 404 });
  const saved = addReview({
    businessId: business.id,
    author: String(body.author ?? ""),
    rating: Number(body.rating),
    body: String(body.body ?? ""),
  });
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 400 });
  return NextResponse.json({ review: saved.review });
}
