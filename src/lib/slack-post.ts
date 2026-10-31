import { getDb } from "./db.ts";

export type SlackRouting = {
  hasBotToken: boolean;
  ordersChannel: string;
  textsChannel: string;
};

export type SlackPostResult = {
  configured: boolean;
  ok: boolean;
  detail: string;
};

const CHANNEL_NAME = /^[a-z0-9][a-z0-9_-]{0,79}$/;
const CHANNEL_ID = /^[CG][A-Z0-9]+$/;

function ensureSlackRoutingColumns() {
  const db = getDb();
  const names = new Set(
    (db.prepare("PRAGMA table_info(businesses)").all() as { name: string }[]).map((column) => column.name),
  );
  if (!names.has("slack_bot_token")) {
    db.exec("ALTER TABLE businesses ADD COLUMN slack_bot_token TEXT NOT NULL DEFAULT ''");
  }
  if (!names.has("slack_orders_channel")) {
    db.exec("ALTER TABLE businesses ADD COLUMN slack_orders_channel TEXT NOT NULL DEFAULT ''");
  }
  if (!names.has("slack_texts_channel")) {
    db.exec("ALTER TABLE businesses ADD COLUMN slack_texts_channel TEXT NOT NULL DEFAULT ''");
  }
}

function routingRow(businessId: number) {
  ensureSlackRoutingColumns();
  return getDb()
    .prepare(
      `SELECT slack_bot_token AS token, slack_orders_channel AS ordersChannel, slack_texts_channel AS textsChannel
       FROM businesses WHERE id = ?`,
    )
    .get(businessId) as { token: string; ordersChannel: string; textsChannel: string } | undefined;
}

export function cleanSlackChannel(value: string) {
  const trimmed = value.trim().replace(/^#/, "").replace(/\s+/g, "-");
  if (CHANNEL_ID.test(trimmed)) return trimmed;
  return trimmed.toLowerCase();
}

export function slackChannelError(value: string) {
  if (!value) return null;
  if (CHANNEL_ID.test(value) || CHANNEL_NAME.test(value)) return null;
  return "Use a Slack channel name such as new-orders, or a channel id that starts with C.";
}

export function slackRouting(businessId: number): SlackRouting {
  const row = routingRow(businessId);
  return {
    hasBotToken: Boolean(row?.token),
    ordersChannel: row?.ordersChannel ?? "",
    textsChannel: row?.textsChannel ?? "",
  };
}

export function saveSlackRouting(
  businessId: number,
  input: { botToken: string; ordersChannel: string; textsChannel: string },
) {
  const current = routingRow(businessId);
  if (!current) throw new Error("That business is not on this desk.");
  const ordersChannel = cleanSlackChannel(input.ordersChannel);
  const textsChannel = cleanSlackChannel(input.textsChannel);
  const ordersError = slackChannelError(ordersChannel);
  const textsError = slackChannelError(textsChannel);
  if (ordersError) throw new Error(ordersError);
  if (textsError) throw new Error(textsError);
  const typedToken = input.botToken.trim();
  if (typedToken && !typedToken.startsWith("xoxb-")) {
    throw new Error("The Slack bot token starts with xoxb-.");
  }
  const token = typedToken || current.token;
  if (textsChannel && !ordersChannel) {
    throw new Error("Name the Slack channel for new orders, such as new-orders.");
  }
  if ((ordersChannel || textsChannel) && !token) {
    throw new Error("Paste the Slack bot token. It starts with xoxb-.");
  }
  getDb()
    .prepare(
      `UPDATE businesses
       SET slack_bot_token = ?, slack_orders_channel = ?, slack_texts_channel = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(token, ordersChannel, textsChannel, new Date().toISOString(), businessId);
}

export function slackDestination(businessId: number, kind: "orders" | "texts") {
  const row = routingRow(businessId);
  if (!row?.token) return null;
  const channel = kind === "orders" ? row.ordersChannel : row.textsChannel || row.ordersChannel;
  if (!channel) return null;
  return { token: row.token, channel };
}

export async function postSlackMessage(token: string, channel: string, text: string): Promise<SlackPostResult> {
  try {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ channel, text, unfurl_links: false, unfurl_media: false }),
      signal: AbortSignal.timeout(8000),
    });
    const body = (await response.json()) as { ok?: boolean; error?: string };
    if (body.ok) return { configured: true, ok: true, detail: "" };
    return { configured: true, ok: false, detail: slackErrorDetail(body.error, channel) };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      detail: error instanceof Error ? error.message : "Slack could not be reached.",
    };
  }
}

export async function postBusinessSlack(businessId: number, kind: "orders" | "texts", text: string) {
  const destination = slackDestination(businessId, kind);
  if (!destination) {
    return { configured: false, ok: false, detail: "Slack channel is not saved." };
  }
  return postSlackMessage(destination.token, destination.channel, text);
}

function slackErrorDetail(error: string | undefined, channel: string) {
  if (error === "not_in_channel") return `Invite the bot to #${channel} in Slack, then a new message will post there.`;
  if (error === "channel_not_found") return `Slack could not find #${channel}. Use the channel name or an id that starts with C.`;
  if (error === "invalid_auth" || error === "token_revoked" || error === "not_authed") {
    return "That Slack bot token was rejected. Paste a new token from the Slack app.";
  }
  if (error === "missing_scope") return "The Slack bot needs the chat:write permission, then reinstall the app.";
  return error ? `Slack returned ${error}.` : "Slack did not accept the message.";
}
