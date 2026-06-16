import { jsonOk } from "@/lib/api-response";
import { clearSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST() {
  await clearSession();
  return jsonOk({ loggedOut: true });
}
