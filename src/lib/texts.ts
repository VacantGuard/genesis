import { getDb, OrderError } from "./db.ts";
import { listCompanies, listCustomers } from "./directory.ts";
import { sendTextMessage, textCredentials, textSettings } from "./messaging.ts";
import type { Campaign, SmsDelivery } from "./types.ts";

type SmsRecipient = {
  clientNumber: string;
  name: string;
  phone: string;
  kind: "customer" | "company_contact";
};

export type CampaignRecipient = {
  clientNumber: string;
  name: string;
  phone: string;
  status: "logged" | "sent" | "failed";
  detail: string;
};

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

/** One text through the same campaign log and provider path as menu texts. */
export async function deliverText(input: {
  businessId: number;
  name: string;
  phone: string;
  body: string;
  linkUrl: string;
}) {
  const db = getDb();
  const createdAt = new Date().toISOString();
  const credentials = textCredentials(input.businessId);
  const recorded = db.transaction(() => {
    const campaign = db
      .prepare(
        `INSERT INTO campaigns
          (message, link_url, include_customers, include_company_contacts, recipient_count, created_at, business_id)
         VALUES (?, ?, 0, 0, 1, ?, ?)`,
      )
      .run(input.body, input.linkUrl, createdAt, input.businessId);
    const campaignId = Number(campaign.lastInsertRowid);
    const logged = db
      .prepare(
        `INSERT INTO sms_log
          (campaign_id, recipient_name, recipient_kind, phone, body, status, detail, created_at)
         VALUES (?, ?, 'customer', ?, ?, 'logged', '', ?)`,
      )
      .run(campaignId, input.name, input.phone, input.body, createdAt);
    return { campaignId, logId: Number(logged.lastInsertRowid) };
  })();

  if (!credentials) {
    return { ok: true as const, mode: "logged" as const, campaignId: recorded.campaignId };
  }

  const result = await sendTextMessage(credentials, input.phone, input.body);
  db.prepare("UPDATE sms_log SET status = ?, detail = ? WHERE id = ?").run(
    result.ok ? "sent" : "failed",
    result.ok ? result.detail : result.detail,
    recorded.logId,
  );
  if (!result.ok) {
    return { ok: false as const, mode: "failed" as const, detail: result.detail, campaignId: recorded.campaignId };
  }
  return { ok: true as const, mode: "sent" as const, campaignId: recorded.campaignId };
}

export async function sendCampaign(input: {
  businessId: number;
  message: string;
  linkUrl: string;
  includeCustomers: boolean;
  includeCompanyContacts: boolean;
}) {
  const db = getDb();
  const recipients: SmsRecipient[] = [];
  const seen = new Set<string>();
  const push = (recipient: SmsRecipient) => {
    const key = normalizePhone(recipient.phone);
    if (key.length < 7 || seen.has(key)) return;
    seen.add(key);
    recipients.push(recipient);
  };

  if (input.includeCustomers) {
    for (const customer of listCustomers(input.businessId)) {
      push({ clientNumber: customer.clientNumber, name: customer.name, phone: customer.phone, kind: "customer" });
    }
  }
  if (input.includeCompanyContacts) {
    for (const company of listCompanies(input.businessId)) {
      push({ clientNumber: "", name: company.contactName || company.name, phone: company.phone, kind: "company_contact" });
    }
  }
  if (recipients.length === 0) throw new OrderError("That audience has no phone numbers to log.");

  const credentials = textCredentials(input.businessId);
  const body = input.message.includes(input.linkUrl)
    ? input.message
    : `${input.message.trim()}\n${input.linkUrl}`;
  const createdAt = new Date().toISOString();
  const run = db.transaction(() => {
    const campaign = db
      .prepare(
        `INSERT INTO campaigns
          (message, link_url, include_customers, include_company_contacts, recipient_count, created_at, business_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        body,
        input.linkUrl,
        input.includeCustomers ? 1 : 0,
        input.includeCompanyContacts ? 1 : 0,
        recipients.length,
        createdAt,
        input.businessId,
      );
    const campaignId = Number(campaign.lastInsertRowid);
    const log = db.prepare(
      `INSERT INTO sms_log
        (campaign_id, recipient_name, recipient_kind, phone, body, status, detail, created_at)
       VALUES (?, ?, ?, ?, ?, 'logged', '', ?)`,
    );
    const ids: { id: number; phone: string }[] = [];
    for (const recipient of recipients) {
      const inserted = log.run(campaignId, recipient.name, recipient.kind, recipient.phone, body, createdAt);
      ids.push({ id: Number(inserted.lastInsertRowid), phone: recipient.phone });
    }
    return { campaignId, ids };
  });
  const recorded = run();
  if (!credentials) {
    return {
      campaignId: recorded.campaignId,
      recipientCount: recipients.length,
      sentCount: 0,
      failedCount: 0,
      linkUrl: input.linkUrl,
      mode: "logged" as const,
      recipients: recipients.map(
        (recipient): CampaignRecipient => ({
          clientNumber: recipient.clientNumber,
          name: recipient.name,
          phone: recipient.phone,
          status: "logged",
          detail: "",
        }),
      ),
    };
  }

  let sentCount = 0;
  let failedCount = 0;
  const outcomes: CampaignRecipient[] = [];
  const mark = db.prepare("UPDATE sms_log SET status = ?, detail = ? WHERE id = ?");
  for (let index = 0; index < recorded.ids.length; index += 1) {
    const row = recorded.ids[index];
    const recipient = recipients[index];
    const result = await sendTextMessage(credentials, row.phone, body);
    const status = result.ok ? "sent" : "failed";
    if (result.ok) sentCount += 1;
    else failedCount += 1;
    mark.run(status, result.detail, row.id);
    outcomes.push({
      clientNumber: recipient.clientNumber,
      name: recipient.name,
      phone: recipient.phone,
      status,
      detail: result.detail,
    });
  }
  return {
    campaignId: recorded.campaignId,
    recipientCount: recipients.length,
    sentCount,
    failedCount,
    linkUrl: input.linkUrl,
    mode: "sent" as const,
    recipients: outcomes,
  };
}

export function listCampaigns(businessId: number): Campaign[] {
  textSettings(businessId);
  const db = getDb();
  const campaigns = db
    .prepare(
      `SELECT id, message, link_url AS linkUrl,
              include_customers AS includeCustomers,
              include_company_contacts AS includeCompanyContacts,
              recipient_count AS recipientCount, created_at AS createdAt
       FROM campaigns WHERE business_id = ? ORDER BY id DESC`,
    )
    .all(businessId) as (Omit<Campaign, "includeCustomers" | "includeCompanyContacts" | "deliveries"> & {
    includeCustomers: number;
    includeCompanyContacts: number;
  })[];
  const deliveries = db.prepare(
    `SELECT id, recipient_name AS recipientName, recipient_kind AS recipientKind,
            phone, body, status, detail, created_at AS createdAt
     FROM sms_log WHERE campaign_id = ? ORDER BY id`,
  );
  return campaigns.map((campaign) => ({
    id: campaign.id,
    message: campaign.message,
    linkUrl: campaign.linkUrl,
    includeCustomers: campaign.includeCustomers === 1,
    includeCompanyContacts: campaign.includeCompanyContacts === 1,
    recipientCount: campaign.recipientCount,
    createdAt: campaign.createdAt,
    deliveries: deliveries.all(campaign.id) as SmsDelivery[],
  }));
}
