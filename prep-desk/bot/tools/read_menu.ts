import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { getPublicMenu, listTriggers, operatingBusiness } from "../lib/kitchen";

export default defineTool({
  description:
    "Read the weekly menu and the recent change log for the business connected to this Slack workspace. Use this before answering what is on the menu or what was added.",
  inputSchema: z.object({
    businessSlug: z.string().optional().describe("Only when this call is not from Slack."),
  }),
  execute({ businessSlug }, ctx) {
    const operating = operatingBusiness(ctx.session.auth, businessSlug);
    if (!operating.ok) return { error: operating.error };
    return {
      business: operating.business.name,
      slug: operating.business.slug,
      recentChanges: listTriggers(operating.business.id).map((change) => ({
        summary: change.summary,
        createdAt: change.createdAt,
      })),
      menu: getPublicMenu(operating.business.id),
    };
  },
});
