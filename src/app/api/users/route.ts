import { jsonOk } from "@/lib/api-response";
import { getRepository } from "@/lib/repository-provider";
import { handleRouteError } from "@/lib/route-helpers";

export const runtime = "nodejs";

export async function GET() {
  try {
    const users = await getRepository().listUsers();
    return jsonOk({ users });
  } catch (error) {
    return handleRouteError(error);
  }
}
