import { ACTIVE_STATUSES, STORES } from "./constants";
import { normalizePhone } from "./phone";
import type {
  Activity,
  Lead,
  LeadSource,
  LeadStatus,
  Message,
  MessageDirection,
  StoreId,
  User
} from "./types";

type DemoState = {
  users: DemoUser[];
  leads: Lead[];
  messages: Message[];
  activities: Activity[];
};

type DemoUser = User & {
  password: string;
};

declare global {
  var __lacuevitaDemoState: DemoState | undefined;
}

export function shouldUseDemoStore() {
  return !process.env.DATABASE_URL;
}

function iso(hoursOffset: number) {
  return new Date(Date.now() + hoursOffset * 60 * 60 * 1000).toISOString();
}

function demoUsers(): DemoUser[] {
  return [
    {
      id: "owner-demo",
      name: "Owner",
      email: "owner@lacuevitafurniture.com",
      password: "Owner123!",
      role: "owner",
      store_id: null,
      active: true
    },
    {
      id: "manager-demo",
      name: "Manager",
      email: "manager@lacuevitafurniture.com",
      password: "Manager123!",
      role: "manager",
      store_id: null,
      active: true
    },
    {
      id: "sales-hialeah",
      name: "Hialeah Sales",
      email: "hialeah.sales@lacuevitafurniture.com",
      password: "Hialeah123!",
      role: "salesperson",
      store_id: "hialeah",
      active: true
    },
    {
      id: "sales-sw",
      name: "SW Sales",
      email: "sw.sales@lacuevitafurniture.com",
      password: "SW123!",
      role: "salesperson",
      store_id: "sw",
      active: true
    }
  ];
}

function lead(input: Partial<Lead> & Pick<Lead, "id" | "name" | "whatsapp_number" | "store_id" | "assigned_user_id" | "status">): Lead {
  const created = iso(-36);
  return {
    phone: normalizePhone(input.whatsapp_number),
    source: "whatsapp",
    budget: null,
    notes: null,
    last_contact_date: null,
    next_follow_up_date: iso(20),
    follow_up_count: 0,
    created_at: created,
    updated_at: created,
    last_activity_at: created,
    ...input,
    whatsapp_number: normalizePhone(input.whatsapp_number)
  };
}

function createInitialState(): DemoState {
  const users = demoUsers();
  const leads: Lead[] = [
    lead({
      id: "lead-demo-1",
      name: "Maria Lopez",
      whatsapp_number: "3055550123",
      store_id: "hialeah",
      assigned_user_id: "sales-hialeah",
      assigned_user_name: "Hialeah Sales",
      source: "whatsapp",
      status: "New",
      next_follow_up_date: iso(5),
      last_activity_at: iso(-5)
    }),
    lead({
      id: "lead-demo-2",
      name: "Carlos Rivera",
      whatsapp_number: "7865550199",
      store_id: "hialeah",
      assigned_user_id: "sales-hialeah",
      assigned_user_name: "Hialeah Sales",
      source: "meta_ads",
      status: "Quote Sent",
      budget: "1800.00",
      next_follow_up_date: iso(-3),
      last_contact_date: iso(-28),
      follow_up_count: 2,
      last_activity_at: iso(-28)
    }),
    lead({
      id: "lead-demo-3",
      name: "Ana Martinez",
      whatsapp_number: "3055550456",
      store_id: "sw",
      assigned_user_id: "sales-sw",
      assigned_user_name: "SW Sales",
      source: "whatsapp",
      status: "Follow-Up",
      next_follow_up_date: iso(-8),
      last_contact_date: iso(-60),
      follow_up_count: 5,
      last_activity_at: iso(-60)
    }),
    lead({
      id: "lead-demo-4",
      name: "Luis Gomez",
      whatsapp_number: "7865550788",
      store_id: "sw",
      assigned_user_id: "sales-sw",
      assigned_user_name: "SW Sales",
      source: "walk_in",
      status: "Closed Won",
      budget: "2400.00",
      next_follow_up_date: null,
      last_contact_date: iso(-12),
      follow_up_count: 1,
      last_activity_at: iso(-10)
    })
  ];

  return {
    users,
    leads,
    messages: [
      {
        id: "message-demo-1",
        lead_id: "lead-demo-1",
        direction: "inbound",
        provider: "whatsapp",
        from_number: "+13055550123",
        to_number: "+17867489064",
        body: "Hi, I need a bedroom set",
        external_message_id: "demo-message-1",
        created_at: iso(-5)
      }
    ],
    activities: []
  };
}

function state() {
  if (!globalThis.__lacuevitaDemoState) {
    globalThis.__lacuevitaDemoState = createInitialState();
  }

  return globalThis.__lacuevitaDemoState;
}

function withAssignedUserName(lead: Lead): Lead {
  const user = state().users.find((item) => item.id === lead.assigned_user_id);
  return {
    ...lead,
    assigned_user_name: user?.name || null
  };
}

function publicUser(user: DemoUser): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    store_id: user.store_id,
    active: user.active,
    created_at: user.created_at
  };
}

export async function demoListStores() {
  return STORES;
}

export async function demoListUsers() {
  return state().users.map(publicUser);
}

export async function demoAuthenticateUser(email: string, password: string) {
  const found = state().users.find(
    (user) => user.email.toLowerCase() === email.trim().toLowerCase() && user.password === password && user.active
  );

  if (!found) {
    return null;
  }

  return publicUser(found);
}

export async function demoListLeads(filters: {
  storeId?: StoreId;
  userId?: string;
  status?: LeadStatus;
  search?: string;
  limit?: number;
} = {}) {
  const search = filters.search?.toLowerCase();
  return state()
    .leads.filter((item) => !filters.storeId || item.store_id === filters.storeId)
    .filter((item) => !filters.userId || item.assigned_user_id === filters.userId)
    .filter((item) => !filters.status || item.status === filters.status)
    .filter((item) => {
      if (!search) return true;
      return (
        item.name?.toLowerCase().includes(search) ||
        item.phone.includes(search) ||
        item.whatsapp_number.includes(search)
      );
    })
    .sort((left, right) => new Date(right.last_activity_at).getTime() - new Date(left.last_activity_at).getTime())
    .slice(0, filters.limit || 500)
    .map(withAssignedUserName);
}

export async function demoGetLeadById(id: string) {
  const found = state().leads.find((item) => item.id === id);
  return found ? withAssignedUserName(found) : null;
}

export async function demoFindLeadByWhatsapp(storeId: StoreId, whatsappNumber: string) {
  const normalized = normalizePhone(whatsappNumber);
  const found = state().leads.find((item) => item.store_id === storeId && item.whatsapp_number === normalized);
  return found ? withAssignedUserName(found) : null;
}

export async function demoPickSalespersonForStore(storeId: StoreId) {
  const salespeople = state().users.filter((item) => item.role === "salesperson" && item.store_id === storeId);
  const ranked = salespeople
    .map((user) => ({
      user,
      activeLeads: state().leads.filter(
        (item) => item.assigned_user_id === user.id && ACTIVE_STATUSES.includes(item.status)
      ).length
    }))
    .sort((left, right) => left.activeLeads - right.activeLeads);

  return ranked[0]?.user.id || null;
}

export async function demoCreateLead(input: {
  name: string | null;
  phone: string;
  whatsapp_number: string;
  store_id: StoreId;
  assigned_user_id: string | null;
  source: LeadSource;
}) {
  const now = new Date().toISOString();
  const created = withAssignedUserName({
    id: `lead-demo-${crypto.randomUUID()}`,
    name: input.name,
    phone: normalizePhone(input.phone),
    whatsapp_number: normalizePhone(input.whatsapp_number),
    store_id: input.store_id,
    assigned_user_id: input.assigned_user_id,
    source: input.source,
    status: "New",
    budget: null,
    notes: null,
    last_contact_date: null,
    next_follow_up_date: null,
    follow_up_count: 0,
    created_at: now,
    updated_at: now,
    last_activity_at: now
  });
  state().leads.unshift(created);
  return created;
}

export async function demoUpdateLead(id: string, input: Partial<Lead>) {
  const index = state().leads.findIndex((item) => item.id === id);
  if (index === -1) {
    throw new Error("Lead not found");
  }

  state().leads[index] = withAssignedUserName({
    ...state().leads[index],
    ...input,
    updated_at: new Date().toISOString()
  });
  return state().leads[index];
}

export async function demoCreateMessage(input: {
  lead_id: string;
  direction: MessageDirection;
  provider?: string;
  from_number: string;
  to_number: string;
  body: string;
  external_message_id?: string | null;
  raw_payload?: unknown;
}) {
  const message: Message = {
    id: `message-demo-${crypto.randomUUID()}`,
    lead_id: input.lead_id,
    direction: input.direction,
    provider: input.provider || "whatsapp",
    from_number: normalizePhone(input.from_number),
    to_number: normalizePhone(input.to_number),
    body: input.body,
    external_message_id: input.external_message_id || null,
    raw_payload: input.raw_payload,
    created_at: new Date().toISOString()
  };
  state().messages.push(message);
  return message;
}

export async function demoListMessages(leadId: string) {
  return state()
    .messages.filter((item) => item.lead_id === leadId)
    .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());
}

export async function demoCreateActivity(input: {
  lead_id: string;
  user_id?: string | null;
  type: string;
  from_status?: LeadStatus | null;
  to_status?: LeadStatus | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const activity: Activity = {
    id: `activity-demo-${crypto.randomUUID()}`,
    lead_id: input.lead_id,
    user_id: input.user_id || null,
    type: input.type,
    from_status: input.from_status || null,
    to_status: input.to_status || null,
    notes: input.notes || null,
    metadata: input.metadata || {},
    created_at: new Date().toISOString()
  };
  state().activities.push(activity);
  return activity;
}
