import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { menuLink, operatingBusiness, sendCampaign } from "../lib/kitchen";

export default defineTool({
  description: "Log a text to this business's customers, company contacts, or both. The menu link is added when the message does not already include it.",
  inputSchema: z.object({
    message: z.string().min(2).max(480),
    includeCustomers: z.boolean().default(true),
    includeCompanyContacts: z.boolean().default(false),
    businessSlug: z.string().optional().describe("Only when this call is not from Slack."),
  }),
  execute(input, ctx) {
    const operating = operatingBusiness(ctx.session.auth, input.businessSlug);
    if (!operating.ok) return { error: operating.error };
    if (!input.includeCustomers && !input.includeCompanyContacts) {
      return { error: "Choose customers, company contacts, or both." };
    }
    try {
      const result = sendCampaign({
        businessId: operating.business.id,
        message: input.message.trim(),
        linkUrl: menuLink(operating.business.slug),
        includeCustomers: input.includeCustomers,
        includeCompanyContacts: input.includeCompanyContacts,
      });
      return { logged: true, recipientCount: result.recipientCount, linkUrl: result.linkUrl };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "The text log did not record this message." };
    }
  },
});