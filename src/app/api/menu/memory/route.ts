import { getHomepageBusiness, rememberPublicOrigin } from "@/lib/businesses";
import { publicOrigin, renderMenuMemory, renderMenuMemoryPage } from "@/lib/menu-memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const business = getHomepageBusiness();
  if (!business) {
    return new Response("That menu is not available.\n", { status: 404 });
  }
  const origin = publicOrigin(request);
  rememberPublicOrigin(business.id, origin);
  const wantsMarkdown =
    new URL(request.url).searchParams.get("format") === "md" ||
    (request.headers.get("accept") ?? "").includes("text/markdown");
  return new Response(
    wantsMarkdown ? renderMenuMemory(business, origin) : renderMenuMemoryPage(business, origin),
    {
      headers: {
        "content-type": wantsMarkdown ? "text/markdown; charset=utf-8" : "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}
