import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { getPublicMenu, listTriggers, operatingBusiness, orderBoard } from "../lib/kitchen";

export default defineTool({
  description:
    "Read the weekly menu, recent changes, saved clients, and who has paid since the latest menu update. Use this before answering what is on the menu, what was added, who the clients are, or who paid.",
  inputSchema: z.object({
    businessSlug: z.string().optional().describe("Only when this call is not from Slack."),
  }),
  execute({ businessSlug }, ctx) {
    const operating = operatingBusiness(ctx.session.auth, businessSlug);
    if (!operating.ok) return { error: operating.error };
    const board = orderBoard(operating.business.id);
    return {
      business: operating.business.name,
      slug: operating.business.slug,
      recentChanges: listTriggers(operating.business.id).map((change) => ({
        summary: change.summary,
        createdAt: change.createdAt,
      })),
      menu: getPublicMenu(operating.business.id),
      clients: [
        ...board.ordered.map((order) => ({
          name: order.name,
          phone: order.phone,
          email: order.email,
          paid: true,
          orderNumber: order.orderNumber,
        })),
        ...board.notOrdered.map((client) => ({
          name: client.name,
          phone: client.phone,
          email: client.email,
          paid: false,
          orderNumber: "",
        })),
      ],
    };
  },
});
