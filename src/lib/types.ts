export const LEAD_STATUSES = [
  "New",
  "Contacted",
  "Quote Sent",
  "Follow-Up",
  "Negotiation",
  "Closed Won",
  "Lost"
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type LeadSource = "meta_ads" | "whatsapp" | "walk_in" | "other";
export type StoreId = "hialeah" | "sw";
export type UserRole = "owner" | "manager" | "salesperson";
export type MessageDirection = "inbound" | "outbound";

export type Store = {
  id: StoreId;
  name: string;
  whatsapp_number: string;
  created_at?: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  store_id: StoreId | null;
  active: boolean;
  created_at?: string;
};

export type Lead = {
  id: string;
  name: string | null;
  phone: string;
  whatsapp_number: string;
  store_id: StoreId;
  assigned_user_id: string | null;
  assigned_user_name?: string | null;
  source: LeadSource;
  status: LeadStatus;
  budget: string | number | null;
  notes: string | null;
  last_contact_date: string | null;
  next_follow_up_date: string | null;
  follow_up_count: number;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
};

export type Message = {
  id: string;
  lead_id: string;
  direction: MessageDirection;
  provider: string;
  from_number: string;
  to_number: string;
  body: string | null;
  external_message_id: string | null;
  raw_payload?: unknown;
  created_at: string;
};

export type Activity = {
  id: string;
  lead_id: string;
  user_id: string | null;
  type: string;
  from_status: LeadStatus | null;
  to_status: LeadStatus | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type Appointment = {
  id: string;
  lead_id: string;
  user_id: string | null;
  store_id: StoreId;
  title: string;
  description: string | null;
  scheduled_start: string;
  scheduled_end: string;
  google_event_id: string | null;
  google_event_link: string | null;
  created_at: string;
};

export type DashboardScope =
  | { role: "owner"; storeId?: never; userId?: never }
  | { role: "manager"; storeId: StoreId; userId?: never }
  | { role: "salesperson"; storeId?: never; userId: string };

export type LeadFlags = {
  isOverdue: boolean;
  isStale: boolean;
  isHighFollowUpNoConversion: boolean;
};

export type LeadWithFlags = Lead & LeadFlags;

export type DashboardMetrics = {
  totalLeads: number;
  conversionRate: number;
  leadsByStore: Record<StoreId, number>;
  salesByStage: Record<LeadStatus, number>;
  overdueFollowUps: number;
  staleLeads: number;
  highFollowUpNoConversion: number;
  activeLeads: number;
  missedFollowUps: number;
  salespersonPerformance: Array<{
    user_id: string | null;
    salesperson: string;
    total: number;
    closedWon: number;
    overdue: number;
  }>;
};

export type ParsedWhatsappMessage = {
  toNumber: string;
  fromNumber: string;
  body: string;
  customerName: string | null;
  messageId: string | null;
  source: LeadSource;
  raw: unknown;
};

export type WebhookLeadSnapshot = {
  id: string;
  name: string | null;
  phone: string;
  whatsapp_number: string;
  store_id: StoreId;
  assigned_user_id: string | null;
  source: LeadSource;
  status: LeadStatus;
  last_contact_date: string | null;
  next_follow_up_date: string | null;
  follow_up_count: number;
  last_activity_at: string;
};
