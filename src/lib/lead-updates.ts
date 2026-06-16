import { LEAD_STATUSES, type LeadSource, type LeadStatus } from "./types";

export type SanitizedLeadUpdate = {
  name?: string | null;
  assigned_user_id?: string | null;
  source?: LeadSource;
  status?: LeadStatus;
  budget?: number | null;
  notes?: string | null;
  last_contact_date?: string | null;
  next_follow_up_date?: string | null;
  follow_up_count?: number;
  last_activity_at?: string;
};

const editableFields = new Set([
  "name",
  "assigned_user_id",
  "source",
  "status",
  "budget",
  "notes",
  "last_contact_date",
  "next_follow_up_date",
  "follow_up_count",
  "last_activity_at"
]);

export function parseLeadSourceValue(value: unknown): LeadSource {
  return value === "meta_ads" || value === "walk_in" || value === "other" || value === "whatsapp"
    ? value
    : "whatsapp";
}

export function parseLeadStatusValue(value: unknown): LeadStatus | null {
  return typeof value === "string" && (LEAD_STATUSES as readonly string[]).includes(value)
    ? (value as LeadStatus)
    : null;
}

export function sanitizeLeadUpdate(body: Record<string, unknown>) {
  const update: SanitizedLeadUpdate = {};
  const errors: string[] = [];

  for (const [key, value] of Object.entries(body)) {
    if (!editableFields.has(key)) {
      continue;
    }

    if (key === "status") {
      const status = parseLeadStatusValue(value);
      if (!status) {
        errors.push("Invalid lead status");
      } else {
        update.status = status;
      }
      continue;
    }

    if (key === "source") {
      update.source = parseLeadSourceValue(value);
      continue;
    }

    if (key === "budget") {
      update.budget = value === "" || value === null ? null : Number(value);
      if (Number.isNaN(update.budget)) {
        errors.push("Invalid budget");
      }
      continue;
    }

    if (key === "follow_up_count") {
      const count = Number(value);
      if (!Number.isInteger(count) || count < 0) {
        errors.push("Invalid follow_up_count");
      } else {
        update.follow_up_count = count;
      }
      continue;
    }

    if (key === "name" && (typeof value === "string" || value === null)) update.name = value;
    if (key === "assigned_user_id" && (typeof value === "string" || value === null)) update.assigned_user_id = value;
    if (key === "notes" && (typeof value === "string" || value === null)) update.notes = value;
    if (key === "last_contact_date" && (typeof value === "string" || value === null)) update.last_contact_date = value;
    if (key === "next_follow_up_date" && (typeof value === "string" || value === null)) update.next_follow_up_date = value;
    if (key === "last_activity_at" && typeof value === "string") update.last_activity_at = value;
  }

  return {
    update,
    errors,
    hasChanges: Object.keys(update).length > 0
  };
}

