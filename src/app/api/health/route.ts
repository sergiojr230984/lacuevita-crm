import { jsonOk } from "@/lib/api-response";
import { query } from "@/lib/db";
import { shouldUseDemoStore } from "@/lib/demo-store";
import { handleRouteError } from "@/lib/route-helpers";

export const runtime = "nodejs";

export async function GET() {
  try {
    if (shouldUseDemoStore()) {
      return jsonOk({ status: "ok", database: "demo" });
    }

    await query("SELECT 1");
    return jsonOk({ status: "ok", database: "connected" });
  } catch (error) {
    return handleRouteError(error);
  }
}
