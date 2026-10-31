import { Flash } from "@/components/flash";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveSlackAction } from "@/lib/business-actions";
import { currentBusiness } from "@/lib/current-business";
import { slackRouting } from "@/lib/slack-post";

export default async function SlackPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const query = await searchParams;
  const business = await currentBusiness();
  const routing = slackRouting(business.id);

  return (
    <>
      <div>
        <h1 className="font-heading text-3xl tracking-tight">Slack</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Connect the Slack workspace where staff talk to the menu agent for {business.name}. New
          orders post in the orders channel. Incoming texts post in the text channel, or in the orders
          channel when that field is left blank. Menu updates still go through the agent webhook.
        </p>
      </div>
      <Flash error={query.error} saved={query.saved} />
      <form action={saveSlackAction} className="grid max-w-xl gap-3">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Workspace id</span>
          <Input
            name="teamId"
            defaultValue={business.slackTeamId ?? ""}
            placeholder="T0123ABCD"
            className="h-10 bg-card"
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Workspace name</span>
          <Input
            name="teamName"
            defaultValue={business.slackTeamName}
            placeholder="Optional label for this desk"
            className="h-10 bg-card"
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Bot token</span>
          <Input
            name="botToken"
            type="password"
            autoComplete="off"
            placeholder={routing.hasBotToken ? "Saved. Paste a new token to replace it." : "xoxb-"}
            className="h-10 bg-card"
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">New orders channel</span>
          <Input
            name="ordersChannel"
            defaultValue={routing.ordersChannel}
            placeholder="new-orders"
            className="h-10 bg-card"
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Incoming texts channel</span>
          <Input
            name="textsChannel"
            defaultValue={routing.textsChannel}
            placeholder="Leave blank to use the new orders channel"
            className="h-10 bg-card"
          />
        </label>
        <p className="text-sm text-muted-foreground">
          The workspace id starts with T. The bot token starts with xoxb- and needs chat:write. Invite
          that bot to the channel. Use a channel name such as new-orders, or a channel id that starts
          with C. Leave the workspace id blank and save to disconnect the agent. Leave both channels
          blank to stop posting orders and texts from this page.
        </p>
        <div>
          <Button type="submit">Save Slack workspace</Button>
        </div>
      </form>
    </>
  );
}
