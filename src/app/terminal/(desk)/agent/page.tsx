import { headers } from "next/headers";
import { Flash } from "@/components/flash";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { agentSettings, listTriggers } from "@/lib/agent";
import { saveAgentWebhookAction } from "@/lib/business-actions";
import { menuLink, rememberedOrigin } from "@/lib/businesses";
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
  const publicOriginSaved = rememberedOrigin(business.id);
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host") || "127.0.0.1:43123";
  const proto = headerStore.get("x-forwarded-proto") || "http";
  const requestOrigin = `${proto}://${host}`;
  const agentOrigin = publicOriginSaved || requestOrigin;
  const memoryUrl = `${agentOrigin}/api/menu/memory`;
  const statusUrl = `${agentOrigin}/api/agent/status`;
  const stickyMenu = publicOriginSaved ? menuLink(business.slug, publicOriginSaved) : "";

  return (
    <>
      <div>
        <h1 className="font-heading text-3xl tracking-tight">Agent</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          You talk to the agent in Slack. The agent runs in n8n. Paste the lasting public site URL and
          the n8n webhook here. Menu texts keep the public URL you save — they do not follow localhost.
        </p>
      </div>
      <Flash error={query.error} saved={query.saved} />
      <form action={saveAgentWebhookAction} className="grid max-w-xl gap-3">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Public site URL</span>
          <Input
            name="publicOrigin"
            type="url"
            defaultValue={publicOriginSaved}
            placeholder="https://your-tunnel-or-domain.example"
            className="h-10 bg-card"
          />
        </label>
        {stickyMenu ? (
          <p className="text-sm text-muted-foreground">
            Menu link for agents:{" "}
            <a href={stickyMenu} className="text-primary underline-offset-2 hover:underline">
              {stickyMenu}
            </a>
          </p>
        ) : null}
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
          <Button type="submit">Save agent settings</Button>
        </div>
      </form>
      <section className="grid max-w-2xl gap-2 text-sm">
        <h2 className="font-heading text-2xl tracking-tight">URLs for John Wick (n8n)</h2>
        <p className="text-muted-foreground">
          If Slack says “incorrect host (domain)”, the HTTP Request tools still point at an old
          tunnel. Paste these hosts into every John Wick tool that reads the desk. Use the Bearer
          token below on status / texts / schedule.
        </p>
        <p className="break-all">
          Menu memory (no auth):{" "}
          <a href={memoryUrl} className="text-primary underline-offset-2 hover:underline">
            {memoryUrl}
          </a>
        </p>
        <p className="break-all">
          Orders / status:{" "}
          <span className="font-mono text-xs">{statusUrl}</span>
        </p>
        <p className="break-all text-muted-foreground">
          Authorization: Bearer {settings.token}
        </p>
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
        <p className="text-muted-foreground">
          A weekly menu text is POST /api/agent/schedule with the same Bearer token. The body is{" "}
          {`{"weekday":"monday","time":"9:00am","timezone":"America/Chicago","message":"This week's menu is ready."}`}
          . Blank fields keep the current day, time, or wording. The desk sends it once, at that
          time, while this site is running. A fixed Monday node in n8n does not move when the agent
          changes the time.
        </p>
      </section>
      <section className="grid max-w-2xl gap-2 text-sm">
        <h2 className="font-heading text-2xl tracking-tight">John Wick instructions</h2>
        <p className="text-muted-foreground">
          Replace the John Wick system message with this, then Publish. Replace each tool description
          with the matching paragraph below.
        </p>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border bg-card p-4 text-sm leading-6">{`You are John Wick, the North Bowl meal prep agent. Staff talk to you in Slack. Answer only from your tools. Do not invent clients, meals, prices, payments, or texts.

Each saved client has one client number, such as C-1001. That number is how you track a client. When you name a client, start with the client number, then the name. Do not track people by first name alone.

When asked about the menu, prices, what changed, who the clients are, who paid, who has not paid, or when the weekly menu text goes out, call the read-only menu tool first. Answer only from that result. The page lists what it answers, then the weekly menu text and its reason, then the payment board, the menu, and the client list. Quote the matching section. Do not say you lack a client directory. Do not say a reason is missing. Do not mention a spreadsheet.

Read the payment board like this. A paid line is: client number | name | phone | order number. A not-paid line is: client number | name | phone. Paid means a checkout since the latest menu update matched that client's phone. A saved client with no matching checkout has not paid. If nobody has paid, say that, then list every not-paid client number.

List every client the tool returned. Do not answer with a count only. Group them as paid and not paid. Put the client number on every line. Include the phone. Include the order number on paid lines.

When staff ask you to text clients, call the text tool and put their requested wording in the message field. The menu link is added for you. Texts go through Sendblue. The tool returns each recipient with a client number, a status, and a detail. Repeat those. If a send fails because the contact must be verified, tell staff to text +1 645 243 7121 from that client's phone first. Do not mention Twilio.

There is no duplicate-text block. If staff ask to send again, or say override, call the text tool again even if that client already received this week's menu. Do not refuse a resend, and do not invent a safeguard.

When staff ask for a recurring menu text, or to change the day or time of that text, call the weekly menu schedule tool. Put the day in weekday, such as monday. Put the clock time in time, such as 9:00am. Use America/Chicago for timezone unless they name another. Put their wording in message when they give it. Leave enabled empty. The word off turns it off only when they say to turn it off. Then repeat the summary word for word, including the reason, and stop. Do not say you cannot create a recurring schedule. Do not send the text tool for a schedule change.

If a tool returns an error, repeat that error and stop.`}</pre>
        <p className="text-muted-foreground">Tool description for the read-only menu HTTP tool:</p>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border bg-card p-4 text-sm leading-6">{`Read North Bowl's weekly menu, client numbers, who has paid, and when the weekly menu text is scheduled. The page starts by listing what it answers. The weekly menu text section includes a reason. Quote that section for schedule questions. Each client line starts with a client number such as C-1001. A paid line also has an order number. A not-paid line does not. Call this before answering about the menu, clients, payments, or the weekly text schedule.`}</pre>
        <p className="text-muted-foreground">Tool description for the weekly menu schedule HTTP tool:</p>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border bg-card p-4 text-sm leading-6">{`Set North Bowl's weekly menu text. Call this when staff ask to send the menu on a schedule or to change that day or time. weekday is a day name such as monday. time is a clock time such as 9:00am. timezone is America/Chicago unless they name another. message is the wording. Leave a field blank to keep its current value. Leave enabled blank. Send off only when staff say to turn the weekly text off. The response always has a reason and a summary. Repeat the summary word for word. This does not send the text immediately.`}</pre>
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
