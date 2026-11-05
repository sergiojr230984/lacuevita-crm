import { jsonError, jsonOk } from "@/lib/api-response";
import { getRepository } from "@/lib/repository-provider";
import { handleRouteError } from "@/lib/route-helpers";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return jsonError("Not logged in", 401);
    }

    const stores = await getRepository().listStores();
    return jsonOk({ stores });
  } catch (error) {
    return handleRouteError(error);
  }
}
