import assert from "node:assert/strict";
import test from "node:test";
import { buildDashboardMetrics } from "../src/lib/dashboard.ts";
import { buildOutboundContactUpdate } from "../src/lib/followups.ts";
import { sanitizeLeadUpdate } from "../src/lib/lead-updates.ts";
import { normalizePhone } from "../src/lib/phone.ts";
import { routeStoreFromToNumber } from "../src/lib/routing.ts";
import { processWhatsappWebhook } from "../src/lib/crm-service.ts";
import type { Lead, Message, StoreId } from "../src/lib/types.ts";

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

  async createLead(input: {
    name: string | null;
    phone: string;
    whatsapp_number: string;
    store_id: StoreId;
    assigned_user_id: string | null;
    source: Lead["source"];
  }) {
    const lead = makeLead({
      id: `lead-${this.leads.length + 1}`,
      ...input,
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

  async createMessage(input: Omit<Message, "id" | "created_at" | "provider"> & { provider?: string }) {
    const message: Message = {
      id: `message-${this.messages.length + 1}`,
      provider: input.provider || "whatsapp",
      created_at: new Date("2026-06-10T12:00:00.000Z").toISOString(),
      ...input
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

