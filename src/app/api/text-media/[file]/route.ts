import { NextResponse } from "next/server";
import { readTextPhoto } from "@/lib/text-media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params;
  const match = /^([a-f0-9]{32})\.(jpg|png)$/i.exec(file);
  if (!match) return NextResponse.json({ error: "That photo could not be found." }, { status: 404 });
  const ext = match[2].toLowerCase() === "png" ? "png" : "jpg";
  const photo = readTextPhoto(match[1], ext);
  if (!photo) return NextResponse.json({ error: "That photo could not be found." }, { status: 404 });
  return new NextResponse(new Uint8Array(photo.bytes), {
    headers: {
      "content-type": photo.contentType,
      "content-length": String(photo.bytes.length),
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
