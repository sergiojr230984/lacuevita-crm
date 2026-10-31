import { STORE_WHATSAPP_NUMBERS } from "./constants";
import { buildOutboundContactUpdate } from "./followups";
import { normalizePhone } from "./phone";
import { parseWhatsappWebhook } from "./whatsapp";
import type { Lead, LeadSource, LeadStatus, Message, ParsedWhatsappMessage, StoreId } from "./types";

export type CrmRepository = {
  findLeadByWhatsapp(storeId: StoreId, whatsappNumber: string): Promise<Lead | null>;
  pickSalespersonForStore(storeId: StoreId): Promise<string | null>;
  routeDestinationNumber(toNumber: string): Promise<{ storeId: StoreId; userId: string | null }>;
  createLead(input: {
    name: string | null;
    phone: string;
    whatsapp_number: string;
    store_id: StoreId;
    assigned_user_id: string | null;
    source: LeadSource;
    first_touch_ad_id?: string | null;
  }): Promise<Lead>;
  updateLead(id: string, input: Partial<Lead>): Promise<Lead>;
  createMessage(input: {
    lead_id: string;
    direction: "inbound" | "outbound";
    provider?: string;
    from_number: string;
    to_number: string;
    body: string;
    external_message_id?: string | null;
    raw_payload?: unknown;
    referral_source_type?: string | null;
    referral_source_id?: string | null;
    referral_source_url?: string | null;
    referral_headline?: string | null;
  }): Promise<Message>;
  createActivity(input: {
    lead_id: string;
    user_id?: string | null;
    type: string;
    from_status?: LeadStatus | null;
    to_status?: LeadStatus | null;
    notes?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<unknown>;
};

export type WebhookProcessResult = {
  processed: number;
  leads: Array<{
    leadId: string;
    storeId: StoreId;
    created: boolean;
    assignedUserId: string | null;
    messageId: string | null;
  }>;
};

async function upsertLeadFromInboundMessage(
  message: ParsedWhatsappMessage,
  repo: CrmRepository,
  now: Date
) {
  // A number explicitly mapped to a salesperson (destination_numbers) routes straight
  // to them; an unmapped number falls back to the existing store-level round robin —
  // see routeDestinationNumber in src/lib/repositories.ts / demo-store.ts.
  const route = await repo.routeDestinationNumber(message.toNumber);
  const storeId = route.storeId;
  const fromNumber = normalizePhone(message.fromNumber);
  let lead = await repo.findLeadByWhatsapp(storeId, fromNumber);
  let created = false;

  if (!lead) {
    const assignedUserId = route.userId || (await repo.pickSalespersonForStore(storeId));
    lead = await repo.createLead({
      name: message.customerName,
      phone: fromNumber,
      whatsapp_number: fromNumber,
      store_id: storeId,
      assigned_user_id: assignedUserId,
      source: message.source,
      // First-touch attribution only — never overwritten by a later message on the
      // same lead, even if that later message carries its own referral.
      first_touch_ad_id: message.referral?.sourceId ?? null
    });
    created = true;
  } else {
    lead = await repo.updateLead(lead.id, {
      name: lead.name || message.customerName,
      last_activity_at: now.toISOString()
    });
  }

  await repo.createMessage({
    lead_id: lead.id,
    direction: "inbound",
    provider: "whatsapp",
    from_number: fromNumber,
    to_number: message.toNumber,
    body: message.body,
    external_message_id: message.messageId,
    raw_payload: message.raw,
    referral_source_type: message.referral?.sourceType ?? null,
    referral_source_id: message.referral?.sourceId ?? null,
    referral_source_url: message.referral?.sourceUrl ?? null,
    referral_headline: message.referral?.headline ?? null
  });

  await repo.createActivity({
    lead_id: lead.id,
    type: created ? "lead_created_from_whatsapp" : "message_received",
    notes: message.body,
    metadata: {
      store_id: storeId,
      to_number: message.toNumber,
      from_number: fromNumber,
      external_message_id: message.messageId,
      routed_to_user_id: route.userId
    }
  });

  return {
    leadId: lead.id,
    storeId,
    created,
    assignedUserId: lead.assigned_user_id,
    messageId: message.messageId
  };
}

export async function processWhatsappWebhook(
  payload: unknown,
  repo: CrmRepository,
  now = new Date()
): Promise<WebhookProcessResult> {
  const messages = parseWhatsappWebhook(payload);
  const leads = [];

  for (const message of messages) {
    leads.push(await upsertLeadFromInboundMessage(message, repo, now));
  }

  return {
    processed: leads.length,
    leads
  };
}

export type OutboundContactInput = {
  lead: Lead;
  body: string;
  userId: string | null;
  nextFollowUpDate?: string | null;
  repo: CrmRepository;
  now?: Date;
};

export async function logOutboundContact({
  lead,
  body,
  userId,
  nextFollowUpDate,
  repo,
  now = new Date()
}: OutboundContactInput) {
  const { firstContact, ...update } = buildOutboundContactUpdate(lead, now, nextFollowUpDate);
  const previousStatus = lead.status;
  const updatedLead = await repo.updateLead(lead.id, update);

  await repo.createMessage({
    lead_id: lead.id,
    direction: "outbound",
    provider: "whatsapp",
    from_number: STORE_WHATSAPP_NUMBERS[lead.store_id],
    to_number: lead.whatsapp_number,
    body,
    raw_payload: { logged_by: userId, manual_log: true }
  });

  await repo.createActivity({
    lead_id: lead.id,
    user_id: userId,
    type: "message_sent",
    notes: body,
    metadata: {
      first_contact: firstContact,
      follow_up_count: update.follow_up_count
    }
  });

  if (previousStatus !== updatedLead.status) {
    await repo.createActivity({
      lead_id: lead.id,
      user_id: userId,
      type: "status_changed",
      from_status: previousStatus,
      to_status: updatedLead.status,
      metadata: { reason: "first_outbound_contact" }
    });
  }

  return updatedLead;
}
