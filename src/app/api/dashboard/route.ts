import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api-response";
import { buildDashboardMetrics } from "@/lib/dashboard";
import { getLeadFlags } from "@/lib/followups";
import { getRepository } from "@/lib/repository-provider";
import { getSearchParam, handleRouteError, parseStoreId } from "@/lib/route-helpers";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return jsonError("Not logged in", 401);
    }

    const requestedStoreId = parseStoreId(getSearchParam(request, "storeId"));
    const storeId =
      currentUser.role === "manager"
        ? currentUser.store_id || requestedStoreId || undefined
        : undefined;
    const userId = currentUser.role === "salesperson" ? currentUser.id : undefined;

    const leads = await getRepository().listLeads({
      storeId,
      userId
    });
    const metrics = buildDashboardMetrics(leads);
    const flaggedLeads = leads.map((lead) => ({
      ...lead,
      ...getLeadFlags(lead)
    }));

    return jsonOk({ metrics, leads: flaggedLeads });
  } catch (error) {
    return handleRouteError(error);
  }
}
