import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api-response";
import { canAccessLead } from "@/lib/authz";
import { getRepository } from "@/lib/repository-provider";
import { getSearchParam, handleRouteError } from "@/lib/route-helpers";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return jsonError("Not logged in", 401);
    }

    const leadId = getSearchParam(request, "leadId");

    if (!leadId) {
      return jsonError("leadId is required", 422);
    }

    const repo = getRepository();
    const lead = await repo.getLeadById(leadId);

    if (!lead) {
      return jsonError("Lead not found", 404);
    }

    if (!canAccessLead(currentUser, lead)) {
      return jsonError("This lead is not available to your login", 403);
    }

    const messages = await repo.listMessages(leadId);
    return jsonOk({ messages });
  } catch (error) {
    return handleRouteError(error);
  }
}
