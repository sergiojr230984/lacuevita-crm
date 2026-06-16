import {
  ACTIVE_STATUSES,
  DEFAULT_FOLLOW_UP_HOURS,
  HIGH_FOLLOW_UP_THRESHOLD,
  STALE_ACTIVITY_HOURS
} from "./constants";
import type { Lead, LeadFlags, LeadStatus } from "./types";

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function isClosedStatus(status: LeadStatus): boolean {
  return !ACTIVE_STATUSES.includes(status);
}

export function isOverdueFollowUp(lead: Pick<Lead, "next_follow_up_date" | "status">, now = new Date()): boolean {
  if (!lead.next_follow_up_date || isClosedStatus(lead.status)) {
    return false;
  }

  return new Date(lead.next_follow_up_date).getTime() < now.getTime();
}

export function isStaleLead(lead: Pick<Lead, "last_activity_at" | "status">, now = new Date()): boolean {
  if (isClosedStatus(lead.status)) {
    return false;
  }

  const staleAfter = now.getTime() - STALE_ACTIVITY_HOURS * 60 * 60 * 1000;
  return new Date(lead.last_activity_at).getTime() < staleAfter;
}

export function isHighFollowUpNoConversion(
  lead: Pick<Lead, "follow_up_count" | "status">
): boolean {
  return lead.follow_up_count >= HIGH_FOLLOW_UP_THRESHOLD && !isClosedStatus(lead.status);
}

export function getLeadFlags(lead: Lead, now = new Date()): LeadFlags {
  return {
    isOverdue: isOverdueFollowUp(lead, now),
    isStale: isStaleLead(lead, now),
    isHighFollowUpNoConversion: isHighFollowUpNoConversion(lead)
  };
}

export function nextDefaultFollowUpDate(now = new Date()): string {
  return addHours(now, DEFAULT_FOLLOW_UP_HOURS).toISOString();
}

export function buildOutboundContactUpdate(
  lead: Pick<Lead, "last_contact_date" | "follow_up_count" | "status">,
  now = new Date(),
  requestedNextFollowUpDate?: string | null
) {
  const firstContact = !lead.last_contact_date;
  const followUpCount = firstContact ? lead.follow_up_count : lead.follow_up_count + 1;
  const status: LeadStatus = lead.status === "New" ? "Contacted" : lead.status;

  return {
    firstContact,
    follow_up_count: followUpCount,
    last_contact_date: now.toISOString(),
    last_activity_at: now.toISOString(),
    next_follow_up_date: requestedNextFollowUpDate || nextDefaultFollowUpDate(now),
    status
  };
}

