import { STORE_WHATSAPP_NUMBERS } from "./constants";
import { buildOutboundContactUpdate } from "./followups";
import { normalizePhone } from "./phone";
import { routeStoreFromToNumber } from "./routing";
import { parseWhatsappWebhook } from "./whatsapp";
import type { Lead, LeadSource, LeadStatus, Message, ParsedWhatsappMessage, StoreId } from "./types";

export type CrmRepository = {
  findLeadByWhatsapp(storeId: StoreId, whatsappNumber: string): Promise<Lead | null>;
  pickSalespersonForStore(storeId: StoreId): Promise<string | null>;
  createLead(input: {
    name: string | null;
    phone: string;
    whatsapp_number: string;
    store_id: StoreId;
    assigned_user_id: string | null;
    source: LeadSource;
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
  const storeId = routeStoreFromToNumber(message.toNumber);
  const fromNumber = normalizePhone(message.fromNumber);
  let lead = await repo.findLeadByWhatsapp(storeId, fromNumber);
  let created = false;

  if (!lead) {
    const assignedUserId = await repo.pickSalespersonForStore(storeId);
    lead = await repo.createLead({
      name: message.customerName,
      phone: fromNumber,
      whatsapp_number: fromNumber,
      store_id: storeId,
      assigned_user_id: assignedUserId,
      source: message.source
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
    raw_payload: message.raw
  });

  await repo.createActivity({
    lead_id: lead.id,
    type: created ? "lead_created_from_whatsapp" : "message_received",
    notes: message.body,
    metadata: {
      store_id: storeId,
      to_number: message.toNumber,
      from_number: fromNumber,
      external_message_id: message.messageId
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
