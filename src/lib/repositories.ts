import { STORE_WHATSAPP_NUMBERS } from "./constants";
import { normalizePhone } from "./phone";
import { routeStoreFromToNumber } from "./routing";
import { query } from "./db";
import type {
  Activity,
  Appointment,
  DestinationNumber,
  Lead,
  LeadSource,
  LeadStatus,
  Message,
  MessageDirection,
  Store,
  StoreId,
  User
} from "./types";

export type LeadFilters = {
  storeId?: StoreId;
  userId?: string;
  status?: LeadStatus;
  search?: string;
  limit?: number;
};

export type CreateLeadInput = {
  name: string | null;
  phone: string;
  whatsapp_number: string;
  store_id: StoreId;
  assigned_user_id: string | null;
  source: LeadSource;
  first_touch_ad_id?: string | null;
};

export type UpdateLeadInput = {
  name?: string | null;
  assigned_user_id?: string | null;
  source?: LeadSource;
  status?: LeadStatus;
  budget?: number | string | null;
  notes?: string | null;
  lost_reason?: string | null;
  estimated_sale_amount?: number | string | null;
  last_contact_date?: string | null;
  next_follow_up_date?: string | null;
  follow_up_count?: number;
  last_activity_at?: string;
};

export type CreateMessageInput = {
  lead_id: string;
  direction: MessageDirection;
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
};

export type DestinationNumberRoute = {
  storeId: StoreId;
  userId: string | null;
};

export type UpsertDestinationNumberInput = {
  phone_number: string;
  store_id: StoreId;
  user_id: string | null;
};

export type CreateActivityInput = {
  lead_id: string;
  user_id?: string | null;
  type: string;
  from_status?: LeadStatus | null;
  to_status?: LeadStatus | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
};

export type AppointmentFilters = {
  leadId?: string;
  storeId?: StoreId;
  userId?: string;
  limit?: number;
};

export type CreateAppointmentInput = {
  lead_id: string;
  user_id?: string | null;
  store_id: StoreId;
  title: string;
  description?: string | null;
  scheduled_start: string;
  scheduled_end: string;
  google_event_id?: string | null;
  google_event_link?: string | null;
};

export async function listStores(): Promise<Store[]> {
  const result = await query<Store>("SELECT * FROM stores ORDER BY id");
  return result.rows;
}

export async function listUsers(): Promise<User[]> {
  const result = await query<User>(
    "SELECT id, name, email, role, store_id, active, created_at FROM users WHERE active = true ORDER BY role, store_id NULLS FIRST, name"
  );
  return result.rows;
}

export async function authenticateUser(email: string, password: string): Promise<User | null> {
  const result = await query<User>(
    `
      SELECT id, name, email, role, store_id, active, created_at
      FROM users
      WHERE lower(email) = lower($1)
        AND active = true
        AND password_hash IS NOT NULL
        AND password_hash = crypt($2, password_hash)
      LIMIT 1
    `,
    [email, password]
  );

  return result.rows[0] || null;
}

export async function listLeads(filters: LeadFilters = {}): Promise<Lead[]> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.storeId) {
    params.push(filters.storeId);
    where.push(`l.store_id = $${params.length}`);
  }

  if (filters.userId) {
    params.push(filters.userId);
    where.push(`l.assigned_user_id = $${params.length}`);
  }

  if (filters.status) {
    params.push(filters.status);
    where.push(`l.status = $${params.length}`);
  }

  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    where.push(`(lower(coalesce(l.name, '')) LIKE $${params.length} OR l.phone LIKE $${params.length} OR l.whatsapp_number LIKE $${params.length})`);
  }

  const limit = Math.min(Math.max(filters.limit || 500, 1), 1000);
  params.push(limit);

  const result = await query<Lead>(
    `
      SELECT l.*, u.name AS assigned_user_name
      FROM leads l
      LEFT JOIN users u ON u.id = l.assigned_user_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY l.last_activity_at DESC
      LIMIT $${params.length}
    `,
    params
  );

  return result.rows;
}

export async function getLeadById(id: string): Promise<Lead | null> {
  const result = await query<Lead>(
    `
      SELECT l.*, u.name AS assigned_user_name
      FROM leads l
      LEFT JOIN users u ON u.id = l.assigned_user_id
      WHERE l.id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

export async function findLeadByWhatsapp(storeId: StoreId, whatsappNumber: string): Promise<Lead | null> {
  const result = await query<Lead>(
    `
      SELECT l.*, u.name AS assigned_user_name
      FROM leads l
      LEFT JOIN users u ON u.id = l.assigned_user_id
      WHERE l.store_id = $1 AND l.whatsapp_number = $2
      LIMIT 1
    `,
    [storeId, normalizePhone(whatsappNumber)]
  );

  return result.rows[0] || null;
}

export async function pickSalespersonForStore(storeId: StoreId): Promise<string | null> {
  const result = await query<{ id: string }>(
    `
      SELECT u.id, count(l.id) AS active_leads
      FROM users u
      LEFT JOIN leads l
        ON l.assigned_user_id = u.id
       AND l.status NOT IN ('Closed Won', 'Lost')
      WHERE u.active = true
        AND u.role = 'salesperson'
        AND u.store_id = $1
      GROUP BY u.id, u.created_at
      ORDER BY active_leads ASC, u.created_at ASC
      LIMIT 1
    `,
    [storeId]
  );

  return result.rows[0]?.id || null;
}

export async function createLead(input: CreateLeadInput): Promise<Lead> {
  const result = await query<Lead>(
    `
      INSERT INTO leads (name, phone, whatsapp_number, store_id, assigned_user_id, source, first_touch_ad_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    [
      input.name,
      normalizePhone(input.phone),
      normalizePhone(input.whatsapp_number),
      input.store_id,
      input.assigned_user_id,
      input.source,
      input.first_touch_ad_id || null
    ]
  );

  return result.rows[0];
}

export async function updateLead(id: string, input: UpdateLeadInput): Promise<Lead> {
  const allowedEntries = Object.entries(input).filter(([, value]) => value !== undefined);

  if (!allowedEntries.length) {
    const existing = await getLeadById(id);
    if (!existing) {
      throw new Error("Lead not found");
    }
    return existing;
  }

  const setSql = allowedEntries.map(([key], index) => `${key} = $${index + 2}`);
  const params = [id, ...allowedEntries.map(([, value]) => value)];

  const result = await query<Lead>(
    `
      UPDATE leads
      SET ${setSql.join(", ")}, updated_at = now()
      WHERE id = $1
      RETURNING *
    `,
    params
  );

  if (!result.rows[0]) {
    throw new Error("Lead not found");
  }

  return result.rows[0];
}

export async function touchInboundLead(lead: Lead, name: string | null, activityDate: Date): Promise<Lead> {
  return updateLead(lead.id, {
    name: lead.name || name,
    last_activity_at: activityDate.toISOString()
  });
}

export async function createMessage(input: CreateMessageInput): Promise<Message> {
  const result = await query<Message>(
    `
      INSERT INTO messages (
        lead_id,
        direction,
        provider,
        from_number,
        to_number,
        body,
        external_message_id,
        raw_payload,
        referral_source_type,
        referral_source_id,
        referral_source_url,
        referral_headline
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `,
    [
      input.lead_id,
      input.direction,
      input.provider || "whatsapp",
      normalizePhone(input.from_number),
      normalizePhone(input.to_number),
      input.body,
      input.external_message_id || null,
      input.raw_payload ? JSON.stringify(input.raw_payload) : null,
      input.referral_source_type || null,
      input.referral_source_id || null,
      input.referral_source_url || null,
      input.referral_headline || null
    ]
  );

  return result.rows[0];
}

export async function listMessages(leadId: string): Promise<Message[]> {
  const result = await query<Message>(
    `
      SELECT *
      FROM messages
      WHERE lead_id = $1
      ORDER BY created_at ASC
    `,
    [leadId]
  );

  return result.rows;
}

export async function createActivity(input: CreateActivityInput): Promise<Activity> {
  const result = await query<Activity>(
    `
      INSERT INTO activities (
        lead_id,
        user_id,
        type,
        from_status,
        to_status,
        notes,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    [
      input.lead_id,
      input.user_id || null,
      input.type,
      input.from_status || null,
      input.to_status || null,
      input.notes || null,
      JSON.stringify(input.metadata || {})
    ]
  );

  return result.rows[0];
}

export async function listActivities(leadId: string): Promise<Activity[]> {
  const result = await query<Activity>(
    `
      SELECT *
      FROM activities
      WHERE lead_id = $1
      ORDER BY created_at DESC
    `,
    [leadId]
  );

  return result.rows;
}

export async function createAppointment(input: CreateAppointmentInput): Promise<Appointment> {
  const result = await query<Appointment>(
    `
      INSERT INTO appointments (
        lead_id,
        user_id,
        store_id,
        title,
        description,
        scheduled_start,
        scheduled_end,
        google_event_id,
        google_event_link
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
    [
      input.lead_id,
      input.user_id || null,
      input.store_id,
      input.title,
      input.description || null,
      input.scheduled_start,
      input.scheduled_end,
      input.google_event_id || null,
      input.google_event_link || null
    ]
  );

  return result.rows[0];
}

export async function listAppointments(filters: AppointmentFilters = {}): Promise<Appointment[]> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.leadId) {
    params.push(filters.leadId);
    where.push(`lead_id = $${params.length}`);
  }

  if (filters.storeId) {
    params.push(filters.storeId);
    where.push(`store_id = $${params.length}`);
  }

  if (filters.userId) {
    params.push(filters.userId);
    where.push(`user_id = $${params.length}`);
  }

  const limit = Math.min(Math.max(filters.limit || 100, 1), 500);
  params.push(limit);

  const result = await query<Appointment>(
    `
      SELECT *
      FROM appointments
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY scheduled_start DESC
      LIMIT $${params.length}
    `,
    params
  );

  return result.rows;
}

export function getStoreWhatsappNumber(storeId: StoreId): string {
  return STORE_WHATSAPP_NUMBERS[storeId];
}

/** Routes an inbound WhatsApp destination number to a salesperson, if one has been
 * explicitly mapped via destination_numbers; otherwise falls back to the existing
 * store-level routing in src/lib/routing.ts (userId: null means "not yet assigned to
 * a specific person — pick one for the store as usual"). */
export async function routeDestinationNumber(toNumber: string): Promise<DestinationNumberRoute> {
  const normalized = normalizePhone(toNumber);
  const result = await query<{ store_id: StoreId; user_id: string | null }>(
    "SELECT store_id, user_id FROM destination_numbers WHERE phone_number = $1",
    [normalized]
  );

  if (result.rows[0]) {
    return { storeId: result.rows[0].store_id, userId: result.rows[0].user_id };
  }

  return { storeId: routeStoreFromToNumber(toNumber), userId: null };
}

export async function listDestinationNumbers(): Promise<DestinationNumber[]> {
  const result = await query<DestinationNumber>(
    `
      SELECT d.*, u.name AS user_name
      FROM destination_numbers d
      LEFT JOIN users u ON u.id = d.user_id
      ORDER BY d.store_id, d.phone_number
    `
  );

  return result.rows;
}

export async function upsertDestinationNumber(input: UpsertDestinationNumberInput): Promise<DestinationNumber> {
  const result = await query<DestinationNumber>(
    `
      INSERT INTO destination_numbers (phone_number, store_id, user_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (phone_number) DO UPDATE
      SET store_id = EXCLUDED.store_id,
          user_id = EXCLUDED.user_id
      RETURNING *
    `,
    [normalizePhone(input.phone_number), input.store_id, input.user_id]
  );

  return result.rows[0];
}
