import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api-response";
import { logOutboundContact } from "@/lib/crm-service";
import { getCrmRepository, getRepository } from "@/lib/repository-provider";
import { handleRouteError } from "@/lib/route-helpers";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return jsonError("Not logged in", 401);
    }

    const repo = getRepository();
    const body = (await request.json()) as Record<string, unknown>;
    const leadId = typeof body.lead_id === "string" ? body.lead_id : "";
    const messageBody = typeof body.body === "string" ? body.body.trim() : "";

    if (!leadId || !messageBody) {
      return jsonError("lead_id and body are required", 422);
    }

    const lead = await repo.getLeadById(leadId);
    if (!lead) {
      return jsonError("Lead not found", 404);
    }

    if (currentUser.role === "salesperson" && lead.assigned_user_id !== currentUser.id) {
      return jsonError("This lead is not assigned to your login", 403);
    }

    if (currentUser.role === "manager" && currentUser.store_id && lead.store_id !== currentUser.store_id) {
      return jsonError("This lead belongs to another store", 403);
    }

    const updatedLead = await logOutboundContact({
      lead,
      body: messageBody,
      userId: currentUser.id,
      nextFollowUpDate: typeof body.next_follow_up_date === "string" ? body.next_follow_up_date : null,
      repo: getCrmRepository()
    });

    return jsonOk({ lead: updatedLead });
  } catch (error) {
    return handleRouteError(error);
  }
}
