import { getDb, OrderError } from "./db.ts";
import { listCompanies, listCustomers } from "./directory.ts";
import type { Campaign, SmsDelivery } from "./types.ts";

type SmsRecipient = {
  name: string;
  phone: string;
  kind: "customer" | "company_contact";
};

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export function sendCampaign(input: {
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
      push({ name: customer.name, phone: customer.phone, kind: "customer" });
    }
  }
  if (input.includeCompanyContacts) {
    for (const company of listCompanies(input.businessId)) {
      push({ name: company.contactName || company.name, phone: company.phone, kind: "company_contact" });
    }
  }
  if (recipients.length === 0) throw new OrderError("That audience has no phone numbers to log.");

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
        (campaign_id, recipient_name, recipient_kind, phone, body, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'logged', ?)`,
    );
    for (const recipient of recipients) {
      log.run(campaignId, recipient.name, recipient.kind, recipient.phone, body, createdAt);
      console.info(
        `[local-sms] status=logged to=${recipient.phone} name=${recipient.name} campaign=${campaignId}`,
      );
    }
    return { campaignId, recipientCount: recipients.length, linkUrl: input.linkUrl };
  });
  return run();
}

export function listCampaigns(businessId: number): Campaign[] {
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
            phone, body, status, created_at AS createdAt
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
