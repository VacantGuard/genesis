import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { getPublicMenu, operatingBusiness } from "../lib/kitchen";

export default defineTool({
  description: "Read the weekly menu for the business connected to this Slack workspace.",
  inputSchema: z.object({
    businessSlug: z.string().optional().describe("Only when this call is not from Slack."),
  }),
  execute({ businessSlug }, ctx) {
    const operating = operatingBusiness(ctx.session.auth, businessSlug);
    if (!operating.ok) return { error: operating.error };
    return {
      business: operating.business.name,
      slug: operating.business.slug,
      menu: getPublicMenu(operating.business.id),
    };
  },
});
