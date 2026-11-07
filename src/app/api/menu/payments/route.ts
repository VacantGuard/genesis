import { NextResponse } from "next/server";
import { getHomepageBusiness } from "@/lib/businesses";
import { paymentBoard, renderPaymentBoard } from "@/lib/menu-memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const business = getHomepageBusiness();
  if (!business) {
    return NextResponse.json({ error: "That menu is not available." }, { status: 404 });
  }
  const format = new URL(request.url).searchParams.get("format");
  const accept = request.headers.get("accept") ?? "";
  if (format === "json" || accept.includes("application/json")) {
    const board = paymentBoard(business);
    return NextResponse.json({
      business: business.name,
      since: board.since,
      paid: board.paid,
      notPaid: board.notPaid,
    });
  }
  return new Response(renderPaymentBoard(business), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
