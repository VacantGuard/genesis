import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { getPublicMenu, listCustomers, listTriggers, operatingBusiness } from "../lib/kitchen";

export default defineTool({
  description:
    "Read the weekly menu, recent changes, and saved clients for the business connected to this Slack workspace. Use this before answering what is on the menu, what was added, or who the clients are.",
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
      clients: listCustomers(operating.business.id).map((customer) => ({
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        company: customer.companyName,
      })),
    };
  },
});
