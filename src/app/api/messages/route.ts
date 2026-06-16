import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api-response";
import { getRepository } from "@/lib/repository-provider";
import { getSearchParam, handleRouteError } from "@/lib/route-helpers";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const leadId = getSearchParam(request, "leadId");

    if (!leadId) {
      return jsonError("leadId is required", 422);
    }

    const messages = await getRepository().listMessages(leadId);
    return jsonOk({ messages });
  } catch (error) {
    return handleRouteError(error);
  }
}
