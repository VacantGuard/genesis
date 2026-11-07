import { NextResponse } from "next/server";
import { readMealPhoto } from "@/lib/meal-photo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const menuItemId = Number(id);
  if (!Number.isInteger(menuItemId) || menuItemId < 1) {
    return NextResponse.json({ error: "That photo could not be found." }, { status: 404 });
  }
  const photo = readMealPhoto(menuItemId);
  if (!photo) return NextResponse.json({ error: "That photo could not be found." }, { status: 404 });
  return new NextResponse(new Uint8Array(photo.bytes), {
    headers: {
      "content-type": photo.contentType,
      "content-length": String(photo.bytes.length),
      "cache-control": "public, max-age=300",
    },
  });
}
