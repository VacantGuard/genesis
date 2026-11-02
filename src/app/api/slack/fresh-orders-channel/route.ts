import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { currentBusiness } from "@/lib/current-business";
import { saveSlackRouting, slackDestination, slackRouting } from "@/lib/slack-post";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NAMES = ["orders", "live-orders", "tigeats-orders"] as const;

type SlackCreate = {
  ok?: boolean;
  error?: string;
  needed?: string;
  channel?: { id?: string; name?: string };
};

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in on the desk first." }, { status: 401 });
  }
  const business = await currentBusiness();
  const destination = slackDestination(business.id, "orders");
  if (!destination?.token) {
    return NextResponse.json({ error: "No Slack bot token is saved." }, { status: 400 });
  }
  const before = slackRouting(business.id);
  let lastError = "Slack did not create a channel.";
  for (const name of NAMES) {
    const response = await fetch("https://slack.com/api/conversations.create", {
      method: "POST",
      headers: {
        authorization: `Bearer ${destination.token}`,
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ name, is_private: false }),
      signal: AbortSignal.timeout(8000),
    });
    const body = (await response.json()) as SlackCreate;
    if (body.ok && body.channel?.name) {
      saveSlackRouting(business.id, {
        botToken: "",
        ordersChannel: body.channel.name,
        textsChannel: before.textsChannel,
      });
      const after = slackRouting(business.id);
      return NextResponse.json({
        ok: true,
        ordersChannel: after.ordersChannel,
        textsChannel: after.textsChannel,
        previousOrdersChannel: before.ordersChannel,
      });
    }
    lastError = body.error || lastError;
    if (body.error === "missing_scope") {
      return NextResponse.json(
        {
          ok: false,
          error: "missing_scope",
          needed: body.needed || "channels:manage",
          ordersChannel: before.ordersChannel,
        },
        { status: 400 },
      );
    }
    if (body.error !== "name_taken") break;
  }
  return NextResponse.json(
    { ok: false, error: lastError, ordersChannel: before.ordersChannel },
    { status: 400 },
  );
}
