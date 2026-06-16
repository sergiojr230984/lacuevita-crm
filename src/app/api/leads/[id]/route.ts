import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api-response";
import { sanitizeLeadUpdate } from "@/lib/lead-updates";
import { getRepository } from "@/lib/repository-provider";
import { handleRouteError } from "@/lib/route-helpers";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return jsonError("Not logged in", 401);
    }

    const repo = getRepository();
    const { id } = await params;
    const lead = await repo.getLeadById(id);

    if (!lead) {
      return jsonError("Lead not found", 404);
    }

    return jsonOk({ lead });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return jsonError("Not logged in", 401);
    }

    const repo = getRepository();
    const { id } = await params;
    const existing = await repo.getLeadById(id);

    if (!existing) {
      return jsonError("Lead not found", 404);
    }

    if (currentUser.role === "salesperson" && existing.assigned_user_id !== currentUser.id) {
      return jsonError("This lead is not assigned to your login", 403);
    }

    if (currentUser.role === "manager" && currentUser.store_id && existing.store_id !== currentUser.store_id) {
      return jsonError("This lead belongs to another store", 403);
    }

    const body = (await request.json()) as Record<string, unknown>;
    const { update, errors, hasChanges } = sanitizeLeadUpdate(body);

    if (errors.length) {
      return jsonError(errors[0], 422);
    }

    if (!hasChanges) {
      return jsonError("No editable lead fields provided", 422);
    }

    const lead = await repo.updateLead(id, update);

    if (existing.status !== lead.status) {
      await repo.createActivity({
        lead_id: lead.id,
        user_id: currentUser.id,
        type: "status_changed",
        from_status: existing.status,
        to_status: lead.status,
        metadata: { source: "pipeline_drag" }
      });
    } else {
      await repo.createActivity({
        lead_id: lead.id,
        user_id: currentUser.id,
        type: "lead_updated",
        metadata: { fields: Object.keys(update) }
      });
    }

    return jsonOk({ lead });
  } catch (error) {
    return handleRouteError(error);
  }
}
