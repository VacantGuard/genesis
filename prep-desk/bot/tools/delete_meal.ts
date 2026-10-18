import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { deleteMenuItem, findMenuItemByName, notifyMenuChange, operatingBusiness } from "../lib/kitchen";

export default defineTool({
  description: "Remove one meal from this business's weekly menu and text clients about the removal.",
  inputSchema: z.object({
    name: z.string().min(2).max(80),
    businessSlug: z.string().optional().describe("Only when this call is not from Slack."),
  }),
  async execute({ name, businessSlug }, ctx) {
    const operating = operatingBusiness(ctx.session.auth, businessSlug);
    if (!operating.ok) return { error: operating.error };
    const existing = findMenuItemByName(operating.business.id, name);
    if (!existing) return { error: `${name} is not on this menu.` };
    const removed = deleteMenuItem(operating.business.id, existing.id);
    if (!removed) return { error: `${name} could not be removed.` };
    const notice = await notifyMenuChange(
      operating.business,
      `${operating.business.name} updated the weekly menu. ${existing.name} was removed.`,
    );
    return { removed: true, name: existing.name, ...notice };
  },
});
