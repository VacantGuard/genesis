import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { currentBusiness } from "@/lib/current-business";
import { OrderError } from "@/lib/db";
import { saveTextPhoto, TEXT_PHOTO_MAX_BYTES } from "@/lib/text-media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in on the desk before attaching a photo." }, { status: 401 });
  }
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > TEXT_PHOTO_MAX_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "That photo is over 4 MB. Use a smaller jpg or png." }, { status: 413 });
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach a jpg or png." }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    const business = await currentBusiness();
    const saved = saveTextPhoto(business.id, { name: file.name, bytes });
    return NextResponse.json({ token: saved.token, name: saved.filename });
  } catch (error) {
    if (error instanceof OrderError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
