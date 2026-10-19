import { headers } from "next/headers";
import { Flash } from "@/components/flash";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { agentSettings, listTriggers } from "@/lib/agent";
import { saveAgentWebhookAction } from "@/lib/business-actions";
import { currentBusiness } from "@/lib/current-business";
import { formatWhen } from "@/lib/format";

export default async function AgentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const query = await searchParams;
  const business = await currentBusiness();
  const settings = agentSettings(business.id);
  const triggers = listTriggers(business.id);
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host") || "127.0.0.1:43123";
  const proto = headerStore.get("x-forwarded-proto") || "http";
  const memoryUrl = `${proto}://${host}/api/menu/memory`;

  return (
    <>
      <div>
        <h1 className="font-heading text-3xl tracking-tight">Agent</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          You talk to the agent in Slack. The agent runs in n8n. Paste the n8n webhook URL here.
          Each menu save sends n8n the new menu link and every client, so the agent can tell them
          and can tell you in Slack who has ordered.
        </p>
      </div>
      <Flash error={query.error} saved={query.saved} />
      <form action={saveAgentWebhookAction} className="grid max-w-xl gap-3">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">n8n webhook URL</span>
          <Input
            name="webhookUrl"
            defaultValue={settings.webhookUrl}
            placeholder="https://your-n8n.example/webhook/menu"
            className="h-10 bg-card"
          />
        </label>
        <p className="text-sm text-muted-foreground">
          In n8n, add a Webhook node that listens for POST. Copy its production URL here. Leave the
          field blank and save to stop sending triggers.
        </p>
        <div>
          <Button type="submit">Save webhook</Button>
        </div>
      </form>
      <section className="grid max-w-2xl gap-2 text-sm">
        <h2 className="font-heading text-2xl tracking-tight">Menu memory</h2>
        <p className="text-muted-foreground">
          The Slack agent answers menu, client, and payment questions from this page. Clients stay
          on the Customers page. A paid checkout is an order matched by phone. This page lists
          both, so the agent does not need a separate client file.
        </p>
        <p className="break-all text-muted-foreground">{memoryUrl}</p>
      </section>
      <section className="grid max-w-2xl gap-2 text-sm">
        <h2 className="font-heading text-2xl tracking-tight">What n8n can ask</h2>
        <p className="text-muted-foreground">
          HTTP Request node, GET /api/agent/status, header Authorization: Bearer {settings.token}
        </p>
        <p className="text-muted-foreground">
          Text clients with POST /api/agent/texts and the same Bearer token. The body is{" "}
          {`{"message":"This week's menu is ready."}`} and the menu link is added for you. The
          reply names each recipient, their phone, and whether that text sent or failed. A text
          platform has to be saved on Texts first, or the send is only logged.
        </p>
        <p className="text-muted-foreground">
          The public menu JSON is GET /api/menu and does not need the token. The Slack workspace id
          for this business is saved on the Slack page and is included on each trigger.
        </p>
      </section>
      <section className="grid max-w-2xl gap-2 text-sm">
        <h2 className="font-heading text-2xl tracking-tight">John Wick instructions</h2>
        <p className="text-muted-foreground">
          Paste this into the John Wick system message, then Publish. A second text is allowed.
          The desk does not block a resend.
        </p>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border bg-card p-4 text-sm leading-6">{`You are John Wick, the North Bowl meal prep agent.

When asked about the menu, new items, prices, what changed, who the clients are, or who paid, call the read-only menu tool and answer only from its result. Clients, Who paid, and Who has not paid are on that page. Every saved client has a client number such as C-1004. When you name a client, include that client number. Do not say you lack access. Do not mention a spreadsheet.

When staff ask you to text clients, call the text tool and put their requested text in the message field. The menu link is added for you. Texts go through Sendblue. If a send fails because a contact must be verified, tell staff to text +1 645 243 7121 from that client's phone first. Do not mention Twilio.

There is no duplicate-text block. If staff ask to send again, or say override, call the text tool again even if that person already received this week's menu link. Do not refuse a resend, and do not invent a safeguard.

Name each recipient and the detail the text tool returns. If a tool returns an error, repeat that error and stop.`}</pre>
      </section>
      <section className="grid gap-3">
        <h2 className="font-heading text-2xl tracking-tight">Menu triggers</h2>
        {triggers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No menu update has been sent to the agent yet.</p>
        ) : (
          triggers.map((trigger) => (
            <article key={trigger.id} className="rounded-xl border bg-card p-4 text-sm">
              <p className="font-medium">{trigger.summary}</p>
              <p className="mt-1 text-muted-foreground">
                {formatWhen(trigger.createdAt)} · {trigger.clientCount} clients · {trigger.delivery}
                {trigger.detail ? ` · ${trigger.detail}` : ""}
              </p>
              <p className="mt-1 break-all text-muted-foreground">{trigger.menuUrl}</p>
            </article>
          ))
        )}
      </section>
    </>
  );
}
