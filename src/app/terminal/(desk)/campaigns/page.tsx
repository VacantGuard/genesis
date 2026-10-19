import { CampaignComposer } from "@/components/terminal/campaign-composer";
import { Badge } from "@/components/ui/badge";
import { getAgentSettings, listCampaigns, listCompanies, listCustomers } from "@/lib/db";
import { formatWhen } from "@/lib/format";

export default function CampaignsPage() {
  const customers = listCustomers();
  const companies = listCompanies();
  const campaigns = listCampaigns();
  const agent = getAgentSettings();

  return (
    <>
      <div>
        <h1 className="font-heading text-3xl tracking-tight">Text campaigns</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Choose customers, company contacts, or both. Sending writes each text to the local log.
          No SMS provider is called. The menu link comes from{" "}
          <a href="/terminal/agent" className="text-primary underline-offset-2 hover:underline">
            Terminal → Agent
          </a>
          {agent.menuLinkUrl ? (
            <>
              {" "}
              (<a href={agent.menuLinkUrl} className="underline-offset-2 hover:underline">{agent.menuLinkUrl}</a>).
            </>
          ) : (
            <> — set the public site URL there before sending.</>
          )}
        </p>
      </div>
      <CampaignComposer customers={customers} companies={companies} />

      <section className="grid gap-3">
        <h2 className="font-heading text-2xl tracking-tight">History</h2>
        {campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No campaigns logged yet.</p>
        ) : (
          campaigns.map((campaign) => (
            <article key={campaign.id} className="grid gap-3 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{formatWhen(campaign.createdAt)}</span>
                <Badge variant="outline">{campaign.recipientCount} logged</Badge>
                {campaign.includeCustomers ? <Badge variant="secondary">Customers</Badge> : null}
                {campaign.includeCompanyContacts ? <Badge variant="secondary">Companies</Badge> : null}
              </div>
              <p className="text-sm whitespace-pre-wrap">{campaign.message}</p>
              <p className="text-sm">
                Link included:{" "}
                <a href={campaign.linkUrl} className="text-primary underline-offset-4 hover:underline">
                  {campaign.linkUrl}
                </a>
              </p>
              <ul className="grid gap-1 text-sm text-muted-foreground">
                {campaign.deliveries.map((delivery) => (
                  <li key={delivery.id}>
                    {delivery.recipientName} · {delivery.phone} · {delivery.status}
                  </li>
                ))}
              </ul>
            </article>
          ))
        )}
      </section>
    </>
  );
}
