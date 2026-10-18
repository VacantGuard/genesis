import fs from "node:fs";
import path from "node:path";
import { getBusinessBySlackTeam, getBusinessBySlug, menuLink, type BusinessRecord } from "../../../src/lib/businesses";
import { parseDollarsToCents } from "../../../src/lib/format";
import {
  createCategory,
  createMenuItem,
  deleteMenuItem,
  findMenuItemByName,
  getPublicMenu,
  listCategories,
  updateMenuItem,
} from "../../../src/lib/menu";
import { listTriggers, orderBoard, publishMenuUpdate } from "../../../src/lib/agent";
import { sendCampaign } from "../../../src/lib/texts";

const candidates = [
  path.resolve(import.meta.dirname, "../../../data/kitchen.sqlite"),
  path.resolve(process.cwd(), "data/kitchen.sqlite"),
  path.resolve(process.cwd(), "../data/kitchen.sqlite"),
];
process.env.DATABASE_PATH ??= candidates.find((file) => fs.existsSync(file)) ?? candidates[0];

export type Operating =
  | { ok: true; business: BusinessRecord }
  | { ok: false; error: string };

export function operatingBusiness(auth: { attributes?: Record<string, string> } | null, slug?: string): Operating {
  const teamId = auth?.attributes?.team_id;
  if (teamId) {
    const business = getBusinessBySlackTeam(teamId);
    if (!business) {
      return {
        ok: false,
        error: `This Slack workspace (${teamId}) is not connected to a business. In the staff terminal, open Slack and save this workspace id.`,
      };
    }
    return { ok: true, business };
  }
  if (slug) {
    const business = getBusinessBySlug(slug);
    if (!business) return { ok: false, error: `No business uses the slug ${slug}.` };
    return { ok: true, business };
  }
  return {
    ok: false,
    error: "No Slack workspace is on this session. Pass businessSlug only when calling a tool outside Slack.",
  };
}

export async function notifyMenuChange(business: BusinessRecord, sentence: string) {
  const result = await publishMenuUpdate({ business, summary: sentence });
  return {
    triggerId: result.triggerId,
    delivery: result.delivery,
    clientCount: result.clientCount,
    menuUrl: result.menuUrl,
    detail: result.detail,
  };
}

export {
  getBusinessBySlackTeam,
  createCategory,
  createMenuItem,
  deleteMenuItem,
  findMenuItemByName,
  getPublicMenu,
  listCategories,
  parseDollarsToCents,
  updateMenuItem,
  sendCampaign,
  menuLink,
  orderBoard,
  listTriggers,
};
