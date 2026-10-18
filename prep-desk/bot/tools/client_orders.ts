import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { operatingBusiness, orderBoard } from "../lib/kitchen";

export default defineTool({
  description: "List who has ordered since the latest menu update and who has not.",
  inputSchema: z.object({
    businessSlug: z.string().optional().describe("Only when this call is not from Slack."),
  }),
  execute({ businessSlug }, ctx) {
    const operating = operatingBusiness(ctx.session.auth, businessSlug);
    if (!operating.ok) return { error: operating.error };
    const board = orderBoard(operating.business.id);
    return {
      business: operating.business.name,
      latestTrigger: board.trigger,
      ordered: board.ordered,
      notOrdered: board.notOrdered,
    };
  },
});
