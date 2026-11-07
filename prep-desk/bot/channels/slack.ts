import { slackChannel, defaultSlackAuth } from "@cursor/bdk/channels/slack";
import type { SlackBinding, SlackMessage } from "@cursor/bdk/channels/slack";
import { getBusinessBySlackTeam } from "../lib/kitchen";

async function admit(ctx: SlackBinding, message: SlackMessage) {
  const auth = defaultSlackAuth(message, ctx);
  if (!auth) return null;
  const teamId = message.teamId;
  if (!teamId) {
    await ctx.thread.post("This Slack event did not include a workspace id, so no business can be opened.");
    return null;
  }
  const business = getBusinessBySlackTeam(teamId);
  if (!business) {
    await ctx.thread.post(
      `This Slack workspace (${teamId}) is not connected to a business. In the staff terminal, open Slack for the business you run and save this workspace id.`,
    );
    return null;
  }
  await ctx.thread.startTyping("Checking the weekly menu");
  return {
    auth,
    context: [
      `You are speaking with staff for "${business.name}" (slug ${business.slug}). The tools already use this business.`,
    ],
  };
}

export default slackChannel({
  envPrefix: "PREP_DESK",
  suggestedPrompts: [
    { title: "This week's menu", message: "What is on this week's menu?" },
    { title: "Text clients", message: "Text clients that this week's menu is ready for pickup." },
  ],
  onAppMention: admit,
  onDirectMessage: admit,
});
