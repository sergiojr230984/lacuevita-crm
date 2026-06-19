import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api-response";
import { shouldUseDemoStore } from "@/lib/demo-store";
import { createGoogleCalendarEvent, isGoogleCalendarConfigured } from "@/lib/google-calendar";
import { getRepository } from "@/lib/repository-provider";
import { getSearchParam, handleRouteError } from "@/lib/route-helpers";
import { getCurrentUser } from "@/lib/session";
import type { Lead, User } from "@/lib/types";

export const runtime = "nodejs";

function canAccessLead(user: User, lead: Lead) {
  if (user.role === "owner") return true;
  if (user.role === "salesperson") return lead.assigned_user_id === user.id;
  return !user.store_id || lead.store_id === user.store_id;
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDurationMinutes(value: unknown) {
  const parsed = Number(value || 60);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed);
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return jsonError("Not logged in", 401);
    }

    const repo = getRepository();
    const leadId = getSearchParam(request, "leadId");

    if (leadId) {
      const lead = await repo.getLeadById(leadId);
      if (!lead) {
        return jsonError("Lead not found", 404);
      }

      if (!canAccessLead(currentUser, lead)) {
        return jsonError("This lead is not available to your login", 403);
      }

      const appointments = await repo.listAppointments({ leadId, limit: 20 });
      return jsonOk({ appointments });
    }

    const appointments = await repo.listAppointments({
      storeId: currentUser.role === "manager" && currentUser.store_id ? currentUser.store_id : undefined,
      userId: currentUser.role === "salesperson" ? currentUser.id : undefined,
      limit: 100
    });

    return jsonOk({ appointments });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return jsonError("Not logged in", 401);
    }

    const repo = getRepository();
    const body = (await request.json()) as Record<string, unknown>;
    const leadId = typeof body.lead_id === "string" ? body.lead_id : "";
    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Customer appointment";
    const description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
    const scheduledStart = parseDate(body.scheduled_start);
    const durationMinutes = parseDurationMinutes(body.duration_minutes);

    if (!leadId) {
      return jsonError("lead_id is required", 422);
    }

    if (!scheduledStart) {
      return jsonError("Appointment date and time are required", 422);
    }

    if (!durationMinutes || durationMinutes < 15 || durationMinutes > 480) {
      return jsonError("Appointment duration must be between 15 minutes and 8 hours", 422);
    }

    if (scheduledStart.getTime() < Date.now() - 5 * 60 * 1000) {
      return jsonError("Appointment must be scheduled for now or later", 422);
    }

    const scheduledEnd = new Date(scheduledStart.getTime() + durationMinutes * 60 * 1000);
    const lead = await repo.getLeadById(leadId);

    if (!lead) {
      return jsonError("Lead not found", 404);
    }

    if (!canAccessLead(currentUser, lead)) {
      return jsonError("This lead is not available to your login", 403);
    }

    if (!shouldUseDemoStore() && !isGoogleCalendarConfigured()) {
      return jsonError("Google Calendar is not configured in Railway yet", 503);
    }

    const calendarEvent = shouldUseDemoStore()
      ? {
          id: `demo-calendar-${crypto.randomUUID()}`,
          htmlLink: "https://calendar.google.com/calendar"
        }
      : await createGoogleCalendarEvent({
          title,
          description,
          scheduledStart,
          scheduledEnd,
          lead,
          user: currentUser
        });

    const appointment = await repo.createAppointment({
      lead_id: lead.id,
      user_id: currentUser.id,
      store_id: lead.store_id,
      title,
      description,
      scheduled_start: scheduledStart.toISOString(),
      scheduled_end: scheduledEnd.toISOString(),
      google_event_id: calendarEvent.id,
      google_event_link: calendarEvent.htmlLink
    });

    const updatedLead = await repo.updateLead(lead.id, {
      next_follow_up_date: scheduledStart.toISOString(),
      last_activity_at: new Date().toISOString()
    });

    await repo.createActivity({
      lead_id: lead.id,
      user_id: currentUser.id,
      type: "appointment_scheduled",
      notes: title,
      metadata: {
        appointment_id: appointment.id,
        scheduled_start: scheduledStart.toISOString(),
        scheduled_end: scheduledEnd.toISOString(),
        google_event_id: calendarEvent.id,
        google_event_link: calendarEvent.htmlLink
      }
    });

    return jsonOk({ appointment, lead: updatedLead });
  } catch (error) {
    return handleRouteError(error);
  }
}
