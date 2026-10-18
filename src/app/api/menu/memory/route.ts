import { getHomepageBusiness } from "@/lib/businesses";
import { publicOrigin, renderMenuMemory } from "@/lib/menu-memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const business = getHomepageBusiness();
  if (!business) {
    return new Response("That menu is not available.\n", { status: 404 });
  }
  const origin = publicOrigin(request);
  return new Response(renderMenuMemory(business, origin), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
