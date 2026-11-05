import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api-response";
import { canAccessLead } from "@/lib/authz";
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

    if (!canAccessLead(currentUser, lead)) {
      return jsonError("This lead is not available to your login", 403);
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
