import { headers } from "next/headers";
import { CampaignComposer } from "@/components/terminal/campaign-composer";
import { Flash } from "@/components/flash";
import { TextPlatformForm } from "@/components/terminal/text-platform-form";
import { WeeklyTextForm } from "@/components/terminal/weekly-text-form";
import { Badge } from "@/components/ui/badge";
import { currentBusiness } from "@/lib/current-business";
import { listCompanies, listCustomers } from "@/lib/directory";
import { formatWhen } from "@/lib/format";
import { menuLink, rememberedOrigin } from "@/lib/businesses";
import { textSettings } from "@/lib/messaging";
import { getMenuTextSchedule, scheduleReport } from "@/lib/menu-schedule";
import { listCampaigns } from "@/lib/texts";

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const query = await searchParams;
  const business = await currentBusiness();
  const customers = listCustomers(business.id);
  const companies = listCompanies(business.id);
  const campaigns = listCampaigns(business.id);
  const texting = textSettings(business.id);
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host") || "127.0.0.1:43123";
  const proto = headerStore.get("x-forwarded-proto") || "http";
  const sticky = rememberedOrigin(business.id);
  const menuUrl = menuLink(business.slug, sticky || `${proto}://${host}`);
  const textingReady = texting.ready;
  const weeklySchedule = getMenuTextSchedule(business.id);
  const weeklyText = scheduleReport(weeklySchedule);

  return (
    <>
      <div>
        <h1 className="font-heading text-3xl tracking-tight">Text campaigns</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Choose Sendblue, Twilio, or SimpleTexting for {business.name}, then send the menu link to
          customers and company contacts. The sample 555 numbers on this desk are not real phones.
        </p>
      </div>
      <Flash error={query.error} saved={query.saved} />
      <p className="max-w-2xl text-sm">{weeklyText.summary}</p>
      <WeeklyTextForm schedule={weeklySchedule} />
      <TextPlatformForm settings={texting} />
      <CampaignComposer
        customers={customers}
        companies={companies}
        menuUrl={menuUrl}
        textingReady={textingReady}
      />

      <section className="grid gap-3">
        <h2 className="font-heading text-2xl tracking-tight">History</h2>
        {campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No campaigns yet.</p>
        ) : (
          campaigns.map((campaign) => (
            <article key={campaign.id} className="grid gap-3 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{formatWhen(campaign.createdAt)}</span>
                <Badge variant="outline">{campaign.recipientCount} recipients</Badge>
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
                    {delivery.detail ? ` · ${delivery.detail}` : ""}
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
