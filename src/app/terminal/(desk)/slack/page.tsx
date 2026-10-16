import { Flash } from "@/components/flash";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveSlackAction } from "@/lib/business-actions";
import { currentBusiness } from "@/lib/current-business";

export default async function SlackPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const query = await searchParams;
  const business = await currentBusiness();

  return (
    <>
      <div>
        <h1 className="font-heading text-3xl tracking-tight">Slack</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Connect the Slack workspace where staff talk to the menu agent for {business.name}. The
          agent reads that workspace id from Slack and only changes this business when the ids match.
          Mention the bot, or send it a direct message, after this id is saved.
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
        <p className="text-sm text-muted-foreground">
          The id starts with T. If you mention the bot before saving it, the bot replies with the
          workspace id to paste here. Leave the id blank and save to disconnect this business.
        </p>
        <div>
          <Button type="submit">Save Slack workspace</Button>
        </div>
      </form>
    </>
  );
}
