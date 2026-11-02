import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { currentBusiness } from "@/lib/current-business";
import { cleanSlackChannel, saveSlackRouting, slackChannelError, slackDestination, slackRouting } from "@/lib/slack-post";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SlackChannel = {
  id?: string;
  name?: string;
  created?: number;
  is_member?: boolean;
  is_archived?: boolean;
};

type SlackList = {
  ok?: boolean;
  error?: string;
  needed?: string;
  channels?: SlackChannel[];
  response_metadata?: { next_cursor?: string };
};

async function slackToken() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Sign in on the desk first." }, { status: 401 }) };
  const business = await currentBusiness();
  const destination = slackDestination(business.id, "orders");
  if (!destination?.token) {
    return { error: NextResponse.json({ error: "No Slack bot token is saved." }, { status: 400 }) };
  }
  return { token: destination.token, businessId: business.id };
}

async function listChannels(token: string) {
  const channels: SlackChannel[] = [];
  let cursor = "";
  for (let page = 0; page < 5; page += 1) {
    const url = new URL("https://slack.com/api/conversations.list");
    url.searchParams.set("types", "public_channel");
    url.searchParams.set("exclude_archived", "true");
    url.searchParams.set("limit", "200");
    if (cursor) url.searchParams.set("cursor", cursor);
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    const body = (await response.json()) as SlackList;
    if (!body.ok) return { error: body.error || "Slack did not list channels.", needed: body.needed || "" };
    channels.push(...(body.channels ?? []));
    cursor = body.response_metadata?.next_cursor || "";
    if (!cursor) break;
  }
  return { channels };
}

export async function GET() {
  const auth = await slackToken();
  if ("error" in auth && auth.error) return auth.error;
  const listed = await listChannels(auth.token);
  if ("error" in listed && listed.error) {
    return NextResponse.json({ ok: false, error: listed.error, needed: listed.needed }, { status: 400 });
  }
  const channels = (listed.channels ?? [])
    .filter((channel) => channel.name && !channel.is_archived)
    .map((channel) => ({
      name: channel.name,
      created: channel.created ?? 0,
      member: Boolean(channel.is_member),
    }))
    .sort((a, b) => b.created - a.created);
  const routing = slackRouting(auth.businessId);
  return NextResponse.json({
    ok: true,
    ordersChannel: routing.ordersChannel,
    textsChannel: routing.textsChannel,
    channels,
  });
}

export async function POST(request: Request) {
  const auth = await slackToken();
  if ("error" in auth && auth.error) return auth.error;
  const url = new URL(request.url);
  const requested = cleanSlackChannel(url.searchParams.get("name") || "");
  const nameError = slackChannelError(requested);
  if (!requested || nameError) {
    return NextResponse.json({ error: nameError || "Name the channel you created." }, { status: 400 });
  }
  const listed = await listChannels(auth.token);
  if ("error" in listed && listed.error) {
    return NextResponse.json({ ok: false, error: listed.error, needed: listed.needed }, { status: 400 });
  }
  const match = (listed.channels ?? []).find((channel) => channel.name === requested);
  if (!match?.id || !match.name) {
    return NextResponse.json({ ok: false, error: "channel_not_found", name: requested }, { status: 404 });
  }
  if (!match.is_member) {
    const join = await fetch("https://slack.com/api/conversations.join", {
      method: "POST",
      headers: {
        authorization: `Bearer ${auth.token}`,
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ channel: match.id }),
      signal: AbortSignal.timeout(8000),
    });
    const joined = (await join.json()) as { ok?: boolean; error?: string };
    if (!joined.ok && joined.error !== "already_in_channel") {
      return NextResponse.json({ ok: false, error: joined.error || "Could not join the channel.", name: match.name }, { status: 400 });
    }
  }
  const before = slackRouting(auth.businessId);
  saveSlackRouting(auth.businessId, {
    botToken: "",
    ordersChannel: match.name,
    textsChannel: before.textsChannel,
  });
  const after = slackRouting(auth.businessId);
  return NextResponse.json({
    ok: true,
    ordersChannel: after.ordersChannel,
    textsChannel: after.textsChannel,
    previousOrdersChannel: before.ordersChannel,
  });
}
