import { Flash } from "@/components/flash";
import { Button } from "@/components/ui/button";
import { clearCampaignHistoryAction, createStaffInviteAction, staffOrigin } from "@/lib/staff-actions";
import { listOpenInvites, listStaffAccounts } from "@/lib/staff-access";

export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invite?: string; saved?: string }>;
}) {
  const query = await searchParams;
  const origin = await staffOrigin();
  const accounts = listStaffAccounts();
  const invites = listOpenInvites();
  const fresh = query.invite ? `${origin}/terminal/join/${query.invite}` : "";

  return (
    <>
      <div>
        <h1 className="font-heading text-3xl tracking-tight">Staff access</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Send a link so someone can create their own username and password for this desk. The link
          welcomes them and walks them through the menu, orders, and texts. It works once and expires
          in 7 days. Your original kitchen login keeps working.
        </p>
      </div>
      <Flash
        error={query.error}
        saved={query.saved || (fresh ? "Invite link ready. Send this page address." : undefined)}
      />
      {fresh ? (
        <p className="max-w-2xl break-all rounded-xl border bg-card p-4 text-sm">{fresh}</p>
      ) : null}
      <form action={createStaffInviteAction}>
        <Button type="submit">Create an invite link</Button>
      </form>
      <form action={clearCampaignHistoryAction} className="grid max-w-xl gap-2">
        <p className="text-sm text-muted-foreground">
          Past text campaigns are listed on Texts. Clearing them removes that history. The weekly
          schedule and the text platform stay.
        </p>
        <div>
          <Button type="submit" variant="outline">
            Clear text history
          </Button>
        </div>
      </form>
      {invites.length > 0 ? (
        <section className="grid max-w-2xl gap-2">
          <h2 className="font-heading text-2xl tracking-tight">Open links</h2>
          <ul className="grid gap-2 text-sm">
            {invites.map((invite) => (
              <li key={invite.token} className="break-all rounded-xl border bg-card p-3">
                {origin}/terminal/join/{invite.token}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="grid max-w-2xl gap-2">
        <h2 className="font-heading text-2xl tracking-tight">Usernames</h2>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one has created a username from an invite yet.</p>
        ) : (
          <ul className="grid gap-1 text-sm">
            {accounts.map((account) => (
              <li key={account.username}>{account.username}</li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
