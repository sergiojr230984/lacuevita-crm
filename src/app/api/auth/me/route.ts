import { jsonError, jsonOk } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return jsonError("Not logged in", 401);
  }

  return jsonOk({ user });
}
