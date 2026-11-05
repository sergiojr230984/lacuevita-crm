import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { canAccessLead } from "../src/lib/authz";
import {
  demoCreateLead,
  demoCreateMessage,
  demoFindLeadByWhatsapp
} from "../src/lib/demo-store";
import { signSessionToken, verifySessionToken } from "../src/lib/session-token";
import { isValidWhatsappSignature } from "../src/lib/webhook-signature";
import type { Lead, User } from "../src/lib/types";

function makeUser(partial: Partial<User> = {}): User {
  return {
    id: "user-1",
    name: "Test User",
    email: "user@example.com",
    role: "salesperson",
    store_id: "hialeah",
    active: true,
    ...partial
  };
}

function makeLead(partial: Partial<Lead> = {}): Lead {
  const now = new Date("2026-06-10T12:00:00.000Z").toISOString();
  return {
    id: "lead-1",
    name: "Customer",
    phone: "+13055550123",
    whatsapp_number: "+13055550123",
    store_id: "hialeah",
    assigned_user_id: "sales-hialeah-1",
    source: "whatsapp",
    status: "New",
    budget: null,
    notes: null,
    lost_reason: null,
    estimated_sale_amount: null,
    last_contact_date: null,
    next_follow_up_date: null,
    follow_up_count: 0,
    created_at: now,
    updated_at: now,
    last_activity_at: now,
    ...partial
  };
}

// --- Priority 3: unauthorized / cross-tenant access ---

test("owner can access leads from any store", () => {
  const owner = makeUser({ role: "owner", store_id: null });
  assert.equal(canAccessLead(owner, makeLead({ store_id: "hialeah" })), true);
  assert.equal(canAccessLead(owner, makeLead({ store_id: "sw" })), true);
});

test("a salesperson cannot access another salesperson's lead", () => {
  const salesperson = makeUser({ id: "sales-hialeah-1", role: "salesperson", store_id: "hialeah" });
  const ownLead = makeLead({ assigned_user_id: "sales-hialeah-1" });
  const othersLead = makeLead({ assigned_user_id: "sales-hialeah-2" });

  assert.equal(canAccessLead(salesperson, ownLead), true);
  assert.equal(canAccessLead(salesperson, othersLead), false);
});

test("a Hialeah manager cannot access SW leads and vice versa", () => {
  const hialeahManager = makeUser({ id: "manager-hialeah", role: "manager", store_id: "hialeah" });
  const swManager = makeUser({ id: "manager-sw", role: "manager", store_id: "sw" });

  const hialeahLead = makeLead({ store_id: "hialeah" });
  const swLead = makeLead({ store_id: "sw" });

  assert.equal(canAccessLead(hialeahManager, hialeahLead), true);
  assert.equal(canAccessLead(hialeahManager, swLead), false);
  assert.equal(canAccessLead(swManager, swLead), true);
  assert.equal(canAccessLead(swManager, hialeahLead), false);
});

test("a manager with no assigned store (multi-store) can access any store's leads", () => {
  const multiStoreManager = makeUser({ role: "manager", store_id: null });
  assert.equal(canAccessLead(multiStoreManager, makeLead({ store_id: "hialeah" })), true);
  assert.equal(canAccessLead(multiStoreManager, makeLead({ store_id: "sw" })), true);
});

// --- Priority 3: session token tampering / expiry (unauthorized access) ---

test("a valid session token round-trips to the signed-in user", () => {
  const user = makeUser();
  const token = signSessionToken({ user, expiresAt: Date.now() + 10_000 }, "test-secret");
  const payload = verifySessionToken(token, "test-secret");

  assert.ok(payload);
  assert.equal(payload?.user.id, user.id);
});

test("a tampered session token signature is rejected", () => {
  const user = makeUser();
  const token = signSessionToken({ user, expiresAt: Date.now() + 10_000 }, "test-secret");
  const [body] = token.split(".");
  const tampered = `${body}.not-the-real-signature`;

  assert.equal(verifySessionToken(tampered, "test-secret"), null);
});

test("a session token signed with a different secret is rejected", () => {
  const user = makeUser();
  const token = signSessionToken({ user, expiresAt: Date.now() + 10_000 }, "secret-a");

  assert.equal(verifySessionToken(token, "secret-b"), null);
});

test("an expired session token is rejected", () => {
  const user = makeUser();
  const token = signSessionToken({ user, expiresAt: Date.now() - 1 }, "test-secret");

  assert.equal(verifySessionToken(token, "test-secret"), null);
});

// --- Priority 3: incorrect or missing WhatsApp webhook signatures ---

test("a correctly signed webhook body is accepted", () => {
  const rawBody = JSON.stringify({ hello: "world" });
  const signature = `sha256=${createHmac("sha256", "app-secret").update(rawBody).digest("hex")}`;

  assert.equal(isValidWhatsappSignature(rawBody, signature, "app-secret"), true);
});

test("a missing webhook signature is rejected", () => {
  const rawBody = JSON.stringify({ hello: "world" });
  assert.equal(isValidWhatsappSignature(rawBody, null, "app-secret"), false);
  assert.equal(isValidWhatsappSignature(rawBody, undefined, "app-secret"), false);
});

test("a webhook signature computed with the wrong app secret is rejected", () => {
  const rawBody = JSON.stringify({ hello: "world" });
  const signature = `sha256=${createHmac("sha256", "wrong-secret").update(rawBody).digest("hex")}`;

  assert.equal(isValidWhatsappSignature(rawBody, signature, "app-secret"), false);
});

test("a webhook signature for a different body is rejected (tampered payload)", () => {
  const originalBody = JSON.stringify({ hello: "world" });
  const tamperedBody = JSON.stringify({ hello: "attacker" });
  const signature = `sha256=${createHmac("sha256", "app-secret").update(originalBody).digest("hex")}`;

  assert.equal(isValidWhatsappSignature(tamperedBody, signature, "app-secret"), false);
});

// --- Priority 2: duplicate-record prevention in the demo/fallback store ---

test("demo store does not create a second lead for the same store+customer number", async () => {
  const input = {
    name: "Dedup Tester",
    phone: "+13055559001",
    whatsapp_number: "+13055559001",
    store_id: "hialeah" as const,
    assigned_user_id: null,
    source: "whatsapp" as const
  };

  const first = await demoCreateLead(input);
  const second = await demoCreateLead(input);

  assert.equal(first.id, second.id);
  const found = await demoFindLeadByWhatsapp("hialeah", "+13055559001");
  assert.equal(found?.id, first.id);
});

test("demo store does not create a second message for the same external_message_id", async () => {
  const lead = await demoCreateLead({
    name: "Message Dedup Tester",
    phone: "+13055559002",
    whatsapp_number: "+13055559002",
    store_id: "sw" as const,
    assigned_user_id: null,
    source: "whatsapp" as const
  });

  const messageInput = {
    lead_id: lead.id,
    direction: "inbound" as const,
    from_number: "+13055559002",
    to_number: "+13058019649",
    body: "Hello",
    external_message_id: "wamid.demo-dedup-test"
  };

  const first = await demoCreateMessage(messageInput);
  const second = await demoCreateMessage(messageInput);

  assert.equal(first.id, second.id);
});
