import { Flash } from "@/components/flash";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveAgentSettingsAction } from "@/lib/actions";
import { getAgentSettings } from "@/lib/db";

export default async function AgentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const query = await searchParams;
  const settings = getAgentSettings();

  return (
    <>
      <div>
        <h1 className="font-heading text-3xl tracking-tight">Agent</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          The public site URL you save here stays pinned for menu texts and the Slack / n8n agent.
          It does not change when you open the desk on localhost or a temporary tunnel. Paste the
          lasting link connected to your agents (custom domain or current public URL).
        </p>
      </div>
      <Flash error={query.error} saved={query.saved} />

      <form action={saveAgentSettingsAction} className="grid max-w-2xl gap-4 rounded-xl border bg-card p-4">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Public site URL</span>
          <Input
            name="publicSiteUrl"
            type="url"
            defaultValue={settings.publicSiteUrl}
            placeholder="https://orders.example.com"
            className="h-10 bg-background"
          />
          <span className="text-xs text-muted-foreground">
            Menu texts append <code className="rounded bg-muted px-1">/#pos</code>. Leave blank until
            you have a public link; campaigns will refuse to send without it.
          </span>
        </label>

        {settings.menuLinkUrl ? (
          <p className="text-sm">
            Menu link for agents and texts:{" "}
            <a
              href={settings.menuLinkUrl}
              className="text-primary underline-offset-2 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              {settings.menuLinkUrl}
            </a>
          </p>
        ) : (
          <p className="text-sm text-amber-800">No public site URL saved yet.</p>
        )}

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">n8n webhook URL</span>
          <Input
            name="webhookUrl"
            type="url"
            defaultValue={settings.webhookUrl}
            placeholder="https://…/webhook/…"
            className="h-10 bg-background"
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Webhook token</span>
          <Input
            name="webhookToken"
            type="password"
            defaultValue={settings.webhookToken}
            placeholder="Optional shared secret"
            autoComplete="off"
            className="h-10 bg-background"
          />
        </label>

        <div>
          <Button type="submit">Save agent settings</Button>
        </div>
      </form>

      <div className="max-w-2xl text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Agent reads from the desk</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Clients + delivery locate:{" "}
            <code className="rounded bg-muted px-1">GET /api/agent/clients</code>
          </li>
          <li>
            Sticky public URL is included in that response as{" "}
            <code className="rounded bg-muted px-1">publicSiteUrl</code> /{" "}
            <code className="rounded bg-muted px-1">menuLinkUrl</code>
          </li>
        </ul>
      </div>
    </>
  );
}
