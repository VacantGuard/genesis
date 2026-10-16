import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import {
  createCategory,
  createMenuItem,
  findMenuItemByName,
  listCategories,
  notifyMenuChange,
  operatingBusiness,
  parseDollarsToCents,
  updateMenuItem,
} from "../lib/kitchen";

function categoryId(businessId: number, name: string) {
  const existing = listCategories(businessId).find((category) => category.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;
  createCategory(businessId, name);
  const created = listCategories(businessId).find((category) => category.name.toLowerCase() === name.toLowerCase());
  return created?.id ?? null;
}

export default defineTool({
  description: "Add or update one meal on this business's weekly menu. Texts clients when the meal actually changes.",
  inputSchema: z.object({
    name: z.string().min(2).max(80),
    category: z.string().min(2).max(40),
    description: z.string().max(400).default(""),
    priceDollars: z.string(),
    available: z.boolean().default(true),
    businessSlug: z.string().optional().describe("Only when this call is not from Slack."),
  }),
  execute(input, ctx) {
    const operating = operatingBusiness(ctx.session.auth, input.businessSlug);
    if (!operating.ok) return { error: operating.error };
    const priceCents = parseDollarsToCents(input.priceDollars);
    if (priceCents === null) return { error: "Enter a price in dollars, such as 14 or 14.50." };
    const business = operating.business;
    const category = categoryId(business.id, input.category);
    if (!category) return { error: "That category could not be saved." };

    const existing = findMenuItemByName(business.id, input.name);
    const description = input.description.trim();
    const unchanged =
      existing &&
      existing.categoryId === category &&
      existing.description === description &&
      existing.priceCents === priceCents &&
      existing.available === input.available;
    if (unchanged) {
      return { saved: false, changed: false, name: existing.name, texted: false };
    }

    if (!existing) {
      const created = createMenuItem({
        businessId: business.id,
        categoryId: category,
        name: input.name,
        description,
        priceCents,
        available: input.available,
      });
      if (!created) return { error: "That meal could not be added." };
    } else {
      const updated = updateMenuItem({
        businessId: business.id,
        id: existing.id,
        categoryId: category,
        name: input.name,
        description,
        priceCents,
        available: input.available,
      });
      if (!updated) return { error: "That meal could not be updated." };
    }

    const dollars = (priceCents / 100).toFixed(2);
    const state = input.available ? "available" : "sold out";
    const notice = notifyMenuChange(
      business,
      `${business.name} updated the weekly menu. ${input.name} is ${state} in ${input.category} for $${dollars}.`,
    );
    return { saved: true, changed: true, name: input.name, ...notice };
  },
});
