import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { clearRecordedOrders } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await requireSession();
  const removed = clearRecordedOrders();
  return NextResponse.json({ removed });
}
