import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api-response";
import { normalizePhone } from "@/lib/phone";
import { getRepository } from "@/lib/repository-provider";
import { routeStoreFromToNumber } from "@/lib/routing";
import {
  getSearchParam,
  handleRouteError,
  parseStoreId
} from "@/lib/route-helpers";
import { parseLeadSourceValue, parseLeadStatusValue } from "@/lib/lead-updates";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const repo = getRepository();
    const storeId = parseStoreId(getSearchParam(request, "storeId"));
    const status = parseLeadStatusValue(getSearchParam(request, "status"));
    const userId = getSearchParam(request, "userId") || undefined;
    const search = getSearchParam(request, "search") || undefined;
    const leads = await repo.listLeads({
      storeId: storeId || undefined,
      status: status || undefined,
      userId,
      search
    });

    return jsonOk({ leads });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const repo = getRepository();
    const body = (await request.json()) as Record<string, unknown>;
    const toNumber = typeof body.to_number === "string" ? body.to_number : "";
    const customerNumber = typeof body.whatsapp_number === "string"
      ? body.whatsapp_number
      : typeof body.phone === "string"
        ? body.phone
        : "";

    if (!toNumber || !customerNumber) {
      return jsonError("to_number and customer phone are required", 422);
    }

    const storeId = routeStoreFromToNumber(toNumber);
    const whatsappNumber = normalizePhone(customerNumber);
    const existing = await repo.findLeadByWhatsapp(storeId, whatsappNumber);

    if (existing) {
      return jsonOk({ lead: existing, created: false });
    }

    const assignedUserId = await repo.pickSalespersonForStore(storeId);
    const lead = await repo.createLead({
      name: typeof body.name === "string" ? body.name : null,
      phone: whatsappNumber,
      whatsapp_number: whatsappNumber,
      store_id: storeId,
      assigned_user_id: assignedUserId,
      source: parseLeadSourceValue(body.source)
    });

    await repo.createActivity({
      lead_id: lead.id,
      type: "lead_created",
      metadata: {
        routed_from_to_number: normalizePhone(toNumber),
        store_id: storeId
      }
    });

    return jsonOk({ lead, created: true }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
