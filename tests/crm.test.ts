import assert from "node:assert/strict";
import test from "node:test";
import { buildDashboardMetrics } from "../src/lib/dashboard";
import { buildOutboundContactUpdate } from "../src/lib/followups";
import { requiresLostReason, sanitizeLeadUpdate } from "../src/lib/lead-updates";
import { normalizePhone } from "../src/lib/phone";
import { routeStoreFromToNumber } from "../src/lib/routing";
import { parseWhatsappWebhook } from "../src/lib/whatsapp";
import { processWhatsappWebhook } from "../src/lib/crm-service";
import type { Lead, Message, StoreId } from "../src/lib/types";

function makeLead(partial: Partial<Lead> = {}): Lead {
  const now = new Date("2026-06-10T12:00:00.000Z").toISOString();

  return {
    id: "lead-1",
    name: "Maria",
    phone: "+13055550123",
    whatsapp_number: "+13055550123",
    store_id: "hialeah",
    assigned_user_id: "sales-1",
    assigned_user_name: "Sales One",
    source: "whatsapp",
    status: "New",
    budget: null,
    notes: null,
    lost_reason: null,
    estimated_sale_amount: null,
    first_touch_ad_id: null,
    last_contact_date: null,
    next_follow_up_date: null,
    follow_up_count: 0,
    created_at: now,
    updated_at: now,
    last_activity_at: now,
    ...partial
  };
}

class FakeRepo {
  leads: Lead[] = [];
  messages: Message[] = [];
  activities: unknown[] = [];
  destinationNumbers = new Map<string, { storeId: StoreId; userId: string | null }>();

  async findLeadByWhatsapp(storeId: StoreId, whatsappNumber: string) {
    return (
      this.leads.find(
        (lead) => lead.store_id === storeId && lead.whatsapp_number === normalizePhone(whatsappNumber)
      ) || null
    );
  }

  async pickSalespersonForStore(storeId: StoreId) {
    return storeId === "hialeah" ? "sales-hialeah" : "sales-sw";
  }

  async routeDestinationNumber(toNumber: string) {
    const mapped = this.destinationNumbers.get(normalizePhone(toNumber));
    if (mapped) {
      return mapped;
    }
    return { storeId: routeStoreFromToNumber(toNumber), userId: null };
  }

  async createLead(input: {
    name: string | null;
    phone: string;
    whatsapp_number: string;
    store_id: StoreId;
    assigned_user_id: string | null;
    source: Lead["source"];
    first_touch_ad_id?: string | null;
  }) {
    const lead = makeLead({
      id: `lead-${this.leads.length + 1}`,
      ...input,
      first_touch_ad_id: input.first_touch_ad_id ?? null,
      status: "New",
      created_at: new Date("2026-06-10T12:00:00.000Z").toISOString(),
      updated_at: new Date("2026-06-10T12:00:00.000Z").toISOString(),
      last_activity_at: new Date("2026-06-10T12:00:00.000Z").toISOString()
    });
    this.leads.push(lead);
    return lead;
  }

  async updateLead(id: string, input: Partial<Lead>) {
    const index = this.leads.findIndex((lead) => lead.id === id);
    assert.notEqual(index, -1);
    this.leads[index] = { ...this.leads[index], ...input };
    return this.leads[index];
  }

  async createMessage(input: {
    lead_id: string;
    direction: Message["direction"];
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
  }) {
    const message: Message = {
      id: `message-${this.messages.length + 1}`,
      provider: input.provider || "whatsapp",
      created_at: new Date("2026-06-10T12:00:00.000Z").toISOString(),
      ...input,
      external_message_id: input.external_message_id ?? null,
      referral_source_type: input.referral_source_type ?? null,
      referral_source_id: input.referral_source_id ?? null,
      referral_source_url: input.referral_source_url ?? null,
      referral_headline: input.referral_headline ?? null
    };
    this.messages.push(message);
    return message;
  }

  async createActivity(input: unknown) {
    this.activities.push(input);
    return input;
  }
}

test("routes WhatsApp destination numbers to fixed stores", () => {
  assert.equal(routeStoreFromToNumber("786-748-9064"), "hialeah");
  assert.equal(routeStoreFromToNumber("305-803-9820"), "hialeah");
  assert.equal(routeStoreFromToNumber("+1 (305) 801-9649"), "sw");
  assert.throws(() => routeStoreFromToNumber("555-000-0000"), /Unknown WhatsApp destination/);
});

test("webhook creates a Hialeah lead from to_number and logs inbound message", async () => {
  const repo = new FakeRepo();
  const result = await processWhatsappWebhook(
    {
      to_number: "786-748-9064",
      from_number: "+1 (305) 555-0123",
      body: "Looking for a sofa",
      name: "Maria Lopez",
      message_id: "wamid.test-1"
    },
    repo
  );

  assert.equal(result.processed, 1);
  assert.equal(result.leads[0].storeId, "hialeah");
  assert.equal(result.leads[0].created, true);
  assert.equal(repo.leads[0].store_id, "hialeah");
  assert.equal(repo.leads[0].assigned_user_id, "sales-hialeah");
  assert.equal(repo.messages[0].direction, "inbound");
  assert.equal(repo.messages[0].lead_id, repo.leads[0].id);
});

test("webhook updates an existing lead for the same store and customer number", async () => {
  const repo = new FakeRepo();
  repo.leads.push(makeLead({ id: "lead-existing", name: null }));

  const result = await processWhatsappWebhook(
    {
      to_number: "+17867489064",
      from_number: "3055550123",
      body: "Still interested",
      name: "Maria Lopez"
    },
    repo,
    new Date("2026-06-10T13:00:00.000Z")
  );

  assert.equal(result.leads[0].created, false);
  assert.equal(repo.leads.length, 1);
  assert.equal(repo.leads[0].name, "Maria Lopez");
  assert.equal(repo.leads[0].last_activity_at, "2026-06-10T13:00:00.000Z");
});

test("outbound follow_up_count increments only after the first contact", () => {
  const first = buildOutboundContactUpdate(makeLead(), new Date("2026-06-10T12:00:00.000Z"));
  assert.equal(first.firstContact, true);
  assert.equal(first.follow_up_count, 0);
  assert.equal(first.status, "Contacted");

  const second = buildOutboundContactUpdate(
    makeLead({
      status: "Contacted",
      last_contact_date: "2026-06-10T12:00:00.000Z",
      follow_up_count: 0
    }),
    new Date("2026-06-10T15:00:00.000Z")
  );

  assert.equal(second.firstContact, false);
  assert.equal(second.follow_up_count, 1);
  assert.equal(second.status, "Contacted");
});

test("dashboard flags overdue, stale, and high follow-up leads", () => {
  const metrics = buildDashboardMetrics(
    [
      makeLead({
        id: "overdue",
        next_follow_up_date: "2026-06-09T12:00:00.000Z",
        last_activity_at: "2026-06-07T12:00:00.000Z"
      }),
      makeLead({
        id: "won",
        status: "Closed Won",
        follow_up_count: 9
      }),
      makeLead({
        id: "heavy",
        status: "Negotiation",
        follow_up_count: 5
      })
    ],
    new Date("2026-06-10T13:00:00.000Z")
  );

  assert.equal(metrics.totalLeads, 3);
  assert.equal(metrics.conversionRate, 33.3);
  assert.equal(metrics.overdueFollowUps, 1);
  assert.equal(metrics.staleLeads, 1);
  assert.equal(metrics.highFollowUpNoConversion, 1);
});

test("lead patches ignore store_id and accept pipeline status changes", () => {
  const { update, errors, hasChanges } = sanitizeLeadUpdate({
    status: "Quote Sent",
    store_id: "sw",
    notes: "Customer wants delivery this week"
  });

  assert.deepEqual(errors, []);
  assert.equal(hasChanges, true);
  assert.equal(update.status, "Quote Sent");
  assert.equal(update.notes, "Customer wants delivery this week");
  assert.equal("store_id" in update, false);
});

test("lead patches accept a valid lost_reason and reject an invalid one", () => {
  const valid = sanitizeLeadUpdate({ status: "Lost", lost_reason: "Precio" });
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.update.lost_reason, "Precio");

  const invalid = sanitizeLeadUpdate({ status: "Lost", lost_reason: "Not a real reason" });
  assert.deepEqual(invalid.errors, ["Invalid lost_reason"]);
});

test("lead patches validate estimated_sale_amount as a non-negative number", () => {
  const valid = sanitizeLeadUpdate({ estimated_sale_amount: "1200.50" });
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.update.estimated_sale_amount, 1200.5);

  const cleared = sanitizeLeadUpdate({ estimated_sale_amount: "" });
  assert.deepEqual(cleared.errors, []);
  assert.equal(cleared.update.estimated_sale_amount, null);

  const invalid = sanitizeLeadUpdate({ estimated_sale_amount: "-50" });
  assert.deepEqual(invalid.errors, ["Invalid estimated_sale_amount"]);
});

test("requiresLostReason only blocks a transition to Lost without a reason", () => {
  const leadWithoutReason = makeLead({ status: "Follow-Up", lost_reason: null });

  assert.equal(
    requiresLostReason(leadWithoutReason, { status: "Lost" }),
    "lost_reason is required when marking a lead as Lost"
  );
  assert.equal(requiresLostReason(leadWithoutReason, { status: "Lost", lost_reason: "Precio" }), null);
  assert.equal(requiresLostReason(leadWithoutReason, { notes: "Called twice" }), null);

  const leadAlreadyLostWithReason = makeLead({ status: "Lost", lost_reason: "Precio" });
  assert.equal(requiresLostReason(leadAlreadyLostWithReason, { notes: "Follow-up call" }), null);
});

test("parses Meta's referral object off a Cloud API Click-to-WhatsApp message", () => {
  const [message] = parseWhatsappWebhook({
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { display_phone_number: "17867489064" },
              contacts: [{ wa_id: "13055550123", profile: { name: "Maria Lopez" } }],
              messages: [
                {
                  id: "wamid.ad-1",
                  from: "13055550123",
                  text: { body: "Hi, I saw your ad" },
                  referral: {
                    source_type: "ad",
                    source_id: "120210000000001",
                    source_url: "https://fb.me/abc123",
                    headline: "Living Room Sale"
                  }
                }
              ]
            }
          }
        ]
      }
    ]
  });

  assert.equal(message.source, "meta_ads");
  assert.deepEqual(message.referral, {
    sourceType: "ad",
    sourceId: "120210000000001",
    sourceUrl: "https://fb.me/abc123",
    headline: "Living Room Sale"
  });
});

test("an organic Cloud API message (no referral) stays source whatsapp", () => {
  const [message] = parseWhatsappWebhook({
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { display_phone_number: "17867489064" },
              contacts: [{ wa_id: "13055550123", profile: { name: "Maria Lopez" } }],
              messages: [{ id: "wamid.organic-1", from: "13055550123", text: { body: "Hi" } }]
            }
          }
        ]
      }
    ]
  });

  assert.equal(message.source, "whatsapp");
  assert.equal(message.referral, null);
});

test("a number mapped in destination_numbers routes straight to that salesperson", async () => {
  const repo = new FakeRepo();
  repo.destinationNumbers.set(normalizePhone("+17867489064"), { storeId: "hialeah", userId: "dayi-user-id" });

  const result = await processWhatsappWebhook(
    {
      to_number: "+17867489064",
      from_number: "+13055550199",
      body: "Looking for a dining set",
      name: "New Customer"
    },
    repo
  );

  assert.equal(result.leads[0].assignedUserId, "dayi-user-id");
  assert.equal(repo.leads[0].assigned_user_id, "dayi-user-id");
});

test("an unmapped number still falls back to store-level round robin", async () => {
  const repo = new FakeRepo();

  const result = await processWhatsappWebhook(
    {
      to_number: "+13058019649",
      from_number: "+13055550200",
      body: "Looking for a mattress",
      name: "Another Customer"
    },
    repo
  );

  assert.equal(result.leads[0].storeId, "sw");
  assert.equal(result.leads[0].assignedUserId, "sales-sw");
});

test("first_touch_ad_id is set from the first message's referral and never overwritten", async () => {
  const repo = new FakeRepo();

  await processWhatsappWebhook(
    {
      to_number: "+17867489064",
      from_number: "+13055550321",
      body: "Saw your ad",
      name: "Ad Lead",
      referral: { source_id: "ad-first-touch", source_type: "ad" }
    },
    repo
  );

  assert.equal(repo.leads[0].first_touch_ad_id, "ad-first-touch");

  await processWhatsappWebhook(
    {
      to_number: "+17867489064",
      from_number: "+13055550321",
      body: "Following up",
      referral: { source_id: "ad-second-touch", source_type: "ad" }
    },
    repo
  );

  assert.equal(repo.leads.length, 1);
  assert.equal(repo.leads[0].first_touch_ad_id, "ad-first-touch");
});
