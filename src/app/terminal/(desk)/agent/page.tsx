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
        <h2 className="font-heading text-2xl tracking-tight">What n8n can ask</h2>
        <p className="text-muted-foreground">
          HTTP Request node, GET /api/agent/status, header Authorization: Bearer {settings.token}
        </p>
        <p className="text-muted-foreground">
          The public menu JSON is GET /api/menu and does not need the token. The Slack workspace id
          for this business is saved on the Slack page and is included on each trigger.
        </p>
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
