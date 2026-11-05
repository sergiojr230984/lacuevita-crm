import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api-response";
import { parseStoreId } from "@/lib/route-helpers";
import { getRepository } from "@/lib/repository-provider";
import { handleRouteError } from "@/lib/route-helpers";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

/** Owner/manager only — this is the admin panel for mapping a WhatsApp destination
 * number to a salesperson (routeDestinationNumber reads this table). A manager is
 * scoped to their own store; an owner can manage both. */
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return jsonError("Not logged in", 401);
    }
    if (currentUser.role === "salesperson") {
      return jsonError("Not authorized", 403);
    }

    const repo = getRepository();
    const numbers = await repo.listDestinationNumbers();
    const scoped =
      currentUser.role === "manager" && currentUser.store_id
        ? numbers.filter((entry) => entry.store_id === currentUser.store_id)
        : numbers;

    return jsonOk({ destinationNumbers: scoped });
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
    if (currentUser.role === "salesperson") {
      return jsonError("Not authorized", 403);
    }

    const body = (await request.json()) as Record<string, unknown>;
    const phoneNumber = typeof body.phone_number === "string" ? body.phone_number.trim() : "";
    const storeId = parseStoreId(typeof body.store_id === "string" ? body.store_id : null);
    const userId = typeof body.user_id === "string" && body.user_id ? body.user_id : null;

    if (!phoneNumber || !storeId) {
      return jsonError("phone_number and a valid store_id are required", 422);
    }

    if (currentUser.role === "manager" && currentUser.store_id && storeId !== currentUser.store_id) {
      return jsonError("Managers can only manage numbers for their own store", 403);
    }

    const repo = getRepository();

    if (userId) {
      const users = await repo.listUsers();
      const assignee = users.find((user) => user.id === userId);
      if (!assignee || assignee.role !== "salesperson" || assignee.store_id !== storeId) {
        return jsonError("user_id must be an active salesperson in that store", 422);
      }
    }

    const entry = await repo.upsertDestinationNumber({ phone_number: phoneNumber, store_id: storeId, user_id: userId });
    return jsonOk({ destinationNumber: entry });
  } catch (error) {
    return handleRouteError(error);
  }
}
